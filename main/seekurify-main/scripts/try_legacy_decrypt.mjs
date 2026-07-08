import dotenv from 'dotenv';
dotenv.config();

import('mongoose').then(async (mongooseModule) => {
  const mongoose = mongooseModule.default;
  // connect if not already connected via src/api/db
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/seekurify';
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri);
  }

  const PasswordModule = await import('../src/models/Password.js');
  const Password = PasswordModule.default;
  const { decrypt: primaryDecrypt } = PasswordModule;

  const crypto = await import('crypto');
  const algo = 'aes-256-cbc';

  function decryptWithDerivedKey(encrypted) {
    if (!encrypted || typeof encrypted !== 'string' || !encrypted.includes(':')) return null;
    const [ivHex, encryptedHex] = encrypted.split(':');
    if (!ivHex || !encryptedHex) return null;
    const iv = Buffer.from(ivHex, 'hex');
    const encryptedText = Buffer.from(encryptedHex, 'hex');
    const rawKey = String(process.env.PASSWORD_ENCRYPTION_KEY || '');
    const derivedKey = crypto.createHash('sha256').update(rawKey).digest();
    try {
      const decipher = crypto.createDecipheriv(algo, derivedKey, iv);
      const dec = Buffer.concat([decipher.update(encryptedText), decipher.final()]).toString('utf8');
      return dec;
    } catch (err) {
      return null;
    }
  }

  const ids = [
    '6961e5d7a2136648c30c34a3',
    '6961e9e04e0d91f82b16da23'
  ];

  for (const id of ids) {
    try {
      const doc = await Password.findById(id).lean();
      if (!doc) {
        console.log(`ID ${id}: not found`);
        continue;
      }
      const raw = doc.password;
      console.log('\n---');
      console.log(`ID ${id} raw: ${raw}`);

      // Primary decrypt (model)
      const p = primaryDecrypt(raw);
      console.log(`Primary decrypt result: ${p === '' || p == null ? '[FAILED or EMPTY]' : p}`);

      // Try derived-key decrypt
      const l = decryptWithDerivedKey(raw);
      console.log(`Derived-key decrypt result: ${l === null || l === '' ? '[FAILED or EMPTY]' : l}`);

      if ((p === '' || p == null) && (l && l.length > 0)) {
        console.log('=> Legacy-derived key succeeded while primary failed.');
      } else if ((p && p.length > 0)) {
        console.log('=> Primary key succeeded.');
      } else {
        console.log('=> Both methods failed to decrypt this entry. Consider backup/re-entry.');
      }

    } catch (err) {
      console.error(`Error processing ${id}:`, err.message || err);
    }
  }

  mongoose.connection.close();
}).catch(err => {
  console.error('Failed to run script:', err);
});