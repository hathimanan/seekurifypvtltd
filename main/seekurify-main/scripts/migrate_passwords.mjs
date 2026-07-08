import dotenv from 'dotenv';
dotenv.config();

/**
 * Migration script: re-encrypt legacy password entries to the canonical key
 * Usage (dry-run): node scripts/migrate_passwords.mjs --candidate-keys=oldKey1,oldKey2 --ids=id1,id2
 * Apply changes: node scripts/migrate_passwords.mjs --apply --backup --candidate-keys=... 
 * Options:
 *   --apply                Actually write changes (default is dry-run)
 *   --backup               Create a backup collection 'passwords_backup_<timestamp>' before applying
 *   --ids=comma,separated   Limit to specific document ids
 *   --candidate-keys=comma,separated   Try these keys (raw hex or passphrase) to attempt decryption
 *   --try-derived          Also try SHA-256-derived key from PASSWORD_ENCRYPTION_KEY (legacy behavior)
 *   --limit=N              Only process first N documents
 */

const argv = process.argv.slice(2);
const opts = {};
for (const a of argv) {
  if (a === '--apply') opts.apply = true;
  else if (a === '--backup') opts.backup = true;
  else if (a === '--try-derived') opts.tryDerived = true;
  else if (a.startsWith('--ids=')) opts.ids = a.split('=')[1].split(',').map(s => s.trim()).filter(Boolean);
  else if (a.startsWith('--candidate-keys=')) opts.candidateKeys = a.split('=')[1].split(',').map(s => s.trim()).filter(Boolean);
  else if (a.startsWith('--limit=')) opts.limit = Number(a.split('=')[1]) || undefined;
  else if (a === '--help' || a === '-h') {
    console.log('Usage: node scripts/migrate_passwords.mjs [--apply] [--backup] [--try-derived] [--candidate-keys=k1,k2] [--ids=id1,id2] [--limit=N]');
    process.exit(0);
  }
}

import('mongoose').then(async (mongooseModule) => {
  const mongoose = mongooseModule.default;
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/seekurify';
  await mongoose.connect(uri);
  // ensure DB is connected
  if (mongoose.connection.readyState !== 1) {
    console.error('DB connection failed'); process.exit(1);
  }

  const PasswordModule = await import('../src/models/Password.js');
  const Password = PasswordModule.default;
  const { encrypt: encryptFn, decrypt: primaryDecrypt } = PasswordModule;

  const crypto = await import('crypto');
  const algo = 'aes-256-cbc';

  function decryptWithKey(encrypted, key) {
    try {
      if (!encrypted || typeof encrypted !== 'string' || !encrypted.includes(':')) return null;
      const [ivHex, encryptedHex] = encrypted.split(':');
      if (!ivHex || !encryptedHex) return null;
      const iv = Buffer.from(ivHex, 'hex');
      const encryptedText = Buffer.from(encryptedHex, 'hex');
      let keyBuf;
      // If key looks like 64 hex chars -> use as raw
      if (/^[0-9a-fA-F]{64}$/.test(key)) {
        keyBuf = Buffer.from(key, 'hex');
      } else {
        // derive via sha256
        keyBuf = crypto.createHash('sha256').update(String(key)).digest();
      }
      const decipher = crypto.createDecipheriv(algo, keyBuf, iv);
      const dec = Buffer.concat([decipher.update(encryptedText), decipher.final()]).toString('utf8');
      return dec;
    } catch (err) {
      return null;
    }
  }

  // If candidate keys not supplied, default to empty array
  const candidateKeys = opts.candidateKeys || [];

  // If tryDerived flag set, add the SHA256-derived of current env key as candidate
  if (opts.tryDerived) {
    const rawKey = String(process.env.PASSWORD_ENCRYPTION_KEY || '');
    const derived = crypto.createHash('sha256').update(rawKey).digest('hex');
    // Use as hex string to be recognized as raw 64-hex by decryptWithKey
    candidateKeys.push(derived);
  }

  console.log('Options:', opts);
  console.log('Candidate keys count:', candidateKeys.length);

  // Query
  const query = {};
  if (opts.ids && opts.ids.length > 0) {
    const ids = opts.ids.map(id => mongoose.Types.ObjectId(id));
    query._id = { $in: ids };
  }

  const cursor = Password.find(query).cursor();

  let processed = 0;
  let migrated = 0;
  let skipped = 0;
  let failed = 0;
  const toBackup = [];

  const batchUpdates = [];

  for await (const doc of cursor) {
    if (opts.limit && processed >= opts.limit) break;
    processed++;

    const raw = doc.password;
    const id = String(doc._id);

    // Primary decrypt
    const primaryPlain = primaryDecrypt(raw);
    if (primaryPlain && primaryPlain.length > 0) {
      skipped++;
      console.log(`ID ${id}: already decrypts with primary key — skipping`);
      continue;
    }

    // Try candidate keys
    let found = null;
    for (const key of candidateKeys) {
      const dec = decryptWithKey(raw, key);
      if (dec && dec.length > 0) {
        found = { key, plaintext: dec };
        break;
      }
    }

    if (!found) {
      console.log(`ID ${id}: could not decrypt with candidates — will skip`);
      failed++;
      continue;
    }

    console.log(`ID ${id}: will re-encrypt (found candidate key)`);
    toBackup.push(doc);

    if (opts.apply) {
      // Re-encrypt using canonical encrypt function
      const newEncrypted = encryptFn(found.plaintext);
      // Use direct collection update to avoid pre-save side-effects
      batchUpdates.push({ id, newEncrypted });
      migrated++;
    } else {
      migrated++;
    }
  }

  console.log('\nSummary:');
  console.log('  processed:', processed);
  console.log('  skipped(already primary):', skipped);
  console.log('  would-migrate:', migrated);
  console.log('  failed-to-find-candidate:', failed);

  if (toBackup.length > 0 && opts.apply && opts.backup) {
    const backupCollName = `passwords_backup_${Date.now()}`;
    console.log(`Creating backup collection ${backupCollName} with ${toBackup.length} docs...`);
    const rawDocs = toBackup.map(d => d.toObject ? d.toObject() : d);
    await mongoose.connection.db.collection(backupCollName).insertMany(rawDocs);
    console.log('Backup created.');
  }

  if (opts.apply && batchUpdates.length > 0) {
    console.log('Applying updates...');
    for (const u of batchUpdates) {
      const oid = mongoose.Types.ObjectId(u.id);
      await mongoose.connection.db.collection('passwords').updateOne({ _id: oid }, { $set: { password: u.newEncrypted } });
      console.log(`Updated ${u.id}`);
    }
    console.log('All updates applied.');
  } else if (!opts.apply) {
    console.log('Dry-run complete. Run with --apply to perform changes.');
  }

  mongoose.connection.close();
  process.exit(0);
}).catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});