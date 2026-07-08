import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/seekurify');

import PasswordModule, { encrypt as modelEncrypt, decrypt as modelDecrypt } from '../src/models/Password.js';
const Password = PasswordModule;

console.log('Env key length:', process.env.PASSWORD_ENCRYPTION_KEY ? process.env.PASSWORD_ENCRYPTION_KEY.length : 'MISSING');

async function run() {
  // Create a temporary userId
  const userId = new mongoose.Types.ObjectId();

  const plaintext = 'MyTestP@ssw0rd!';
  console.log('Plaintext:', plaintext);

  const encryptedDirect = modelEncrypt(plaintext);
  console.log('Encrypted (model.encrypt):', encryptedDirect);
  const decryptedDirect = modelDecrypt(encryptedDirect);
  console.log('Decrypted (model.decrypt):', decryptedDirect);

  // Create document
  const doc = new Password({ website: 'UnitTestSite', username: 'tester', password: plaintext, userId });
  await doc.save();
  console.log('Saved doc id:', doc._id);

  // fetch by id raw
  const rawDoc = await Password.findById(doc._id).lean();
  console.log('Stored raw password field:', rawDoc.password);

  // fetch via toJSON transform using findById (not lean)
  const fullDoc = await Password.findById(doc._id);
  console.log('toJSON result password (decrypted):', fullDoc.toJSON().password);

  // Cleanup
  await Password.deleteOne({ _id: doc._id });
  console.log('Cleanup done.');

  await mongoose.connection.close();
}

run().catch(err => {console.error('Test failed:', err); process.exit(1);});