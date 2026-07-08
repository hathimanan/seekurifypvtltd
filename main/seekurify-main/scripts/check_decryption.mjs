import dotenv from 'dotenv';
dotenv.config();

async function run() {
  console.log('Starting decryption check...');

  // Dynamic import AFTER dotenv.config() so env keys are available before model initialization
  const mongoose = (await import('mongoose')).default;
  const db = (await import('../src/api/db.js')).default; // ensures DB connects
  const PasswordModule = await import('../src/models/Password.js');
  const Password = PasswordModule.default;
  const { decrypt: decryptFn } = PasswordModule;

  try {
    // Wait for DB to be ready and then print DB details
    try {
      await new Promise((resolve, reject) => {
        if (mongoose.connection.readyState === 1) return resolve();
        const onOpen = () => resolve();
        mongoose.connection.once('open', onOpen);
        setTimeout(() => reject(new Error('Timed out waiting for DB connection open')), 5000);
      });

      const dbInfo = mongoose.connection.db;
      const dbName = dbInfo.databaseName || mongoose.connection.name;
      console.log('Connected DB name:', dbName);
      const cols = await dbInfo.listCollections().toArray();
      console.log('Collections:', cols.map(c => c.name));
    } catch (infoErr) {
      console.warn('Could not fetch DB info:', infoErr.message);
    }

    const docs = await Password.find({}).lean();
    console.log(`Found ${docs.length} password entries`);

    let formatOk = 0;
    let decryptOk = 0;
    let decryptFail = 0;
    let unexpectedFormat = 0;
    const failures = [];

    for (const d of docs) {
      const id = d._id;
      const raw = d.password;

      if (!raw || typeof raw !== 'string') {
        unexpectedFormat++;
        failures.push({ id, reason: 'missing_or_not_string', raw });
        continue;
      }

      // Basic format checks
      const hasColon = raw.includes(':');
      const parts = raw.split(':');
      if (!hasColon || parts.length !== 2) {
        unexpectedFormat++;
        failures.push({ id, reason: 'invalid_format', raw });
        continue;
      }

      const ivHex = parts[0];
      const cipherHex = parts[1];
      const ivOk = typeof ivHex === 'string' && /^[a-f0-9]{32}$/i.test(ivHex);
      const cipherOk = typeof cipherHex === 'string' && /^[a-f0-9]+$/i.test(cipherHex);

      if (!ivOk || !cipherOk) {
        unexpectedFormat++;
        failures.push({ id, reason: 'invalid_hex', ivHex, cipherHex });
        continue;
      }

      formatOk++;

        // Attempt decrypt using model's decrypt (current key)
      try {
        const decrypted = decryptFn(raw);
        if (decrypted && decrypted.length > 0) {
          decryptOk++;
          continue; // success with primary key
        }
      } catch (err) {
        // fall through to try alternative key
      }

      // Try legacy strategy: hash the env key (if any) and use that as key (compat with older client-side hashing)
      try {
        const cryptoLib = await import('crypto');
        const algo = 'aes-256-cbc';
        const rawKey = String(process.env.PASSWORD_ENCRYPTION_KEY || '');
        const derivedKey = cryptoLib.createHash('sha256').update(rawKey).digest();

        const [ivHex, encryptedHex] = raw.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const encryptedText = Buffer.from(encryptedHex, 'hex');
        const decipher = cryptoLib.createDecipheriv(algo, derivedKey, iv);
        const altDecrypted = Buffer.concat([decipher.update(encryptedText), decipher.final()]).toString('utf8');

        if (altDecrypted && altDecrypted.length > 0) {
          decryptOk++;
          continue; // success with derived key
        }
      } catch (err) {
        // final failure
      }

      decryptFail++;
      failures.push({ id, reason: 'decrypt_empty_or_error', raw });
    }

    console.log('Summary:');
    console.log('  total:', docs.length);
    console.log('  formatOk:', formatOk);
    console.log('  decryptOk:', decryptOk);
    console.log('  decryptFail:', decryptFail);
    console.log('  unexpectedFormat:', unexpectedFormat);

    if (failures.length > 0) {
      console.log('\nFailures (up to 20):');
      console.log(failures.slice(0, 20));
    }

  } catch (err) {
    console.error('Failed to run check:', err);
  } finally {
    mongoose.connection.close();
  }
}

run();
