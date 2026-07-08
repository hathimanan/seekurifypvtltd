// models/Password.js
import mongoose from 'mongoose';
import crypto from 'crypto';
import dotenv from 'dotenv';

// dotenv.config({ path: '.env.development' });
// Ensure encryption key is provided
function getSecretKey() {
  const SECRET_HEX = process.env.PASSWORD_ENCRYPTION_KEY;
  if (SECRET_HEX && /^[0-9a-fA-F]{64}$/.test(SECRET_HEX)) {
    return Buffer.from(SECRET_HEX, 'hex');
  }

  // If explicit DEV key provided, use it
  if (process.env.DEV_PASSWORD_ENCRYPTION_KEY && /^[0-9a-fA-F]{64}$/.test(process.env.DEV_PASSWORD_ENCRYPTION_KEY)) {
    console.warn('⚠️ Using DEV_PASSWORD_ENCRYPTION_KEY for encryption (development only).');
    return Buffer.from(process.env.DEV_PASSWORD_ENCRYPTION_KEY, 'hex');
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('Missing or invalid PASSWORD_ENCRYPTION_KEY in environment (required in production)');
  }

  // Development fallback: generate a temporary key (non-persistent)
  const devHex = process.env.DEV_PASSWORD_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
  console.warn('⚠️ PASSWORD_ENCRYPTION_KEY is not set. Using a temporary development key. Do NOT use this in production.');
  return Buffer.from(devHex, 'hex');
}

// Helper to validate key buffer
function ensureValidKey(buf) {
  if (!Buffer.isBuffer(buf) || buf.length !== 32) {
    throw new Error('PASSWORD_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  }
}

// Encrypt plaintext using AES-256-CBC
export function encrypt(text) {
  const key = getSecretKey();
  ensureValidKey(key);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  // Combine IV and ciphertext
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

// Check if a string is already encrypted (basic format check: IV:EncryptedHex)
export function isEncrypted(password) {
  // allow uppercase hex as well — be case-insensitive to avoid false negatives
  return (
    typeof password === 'string' &&
    password.includes(':') &&
    /^[a-f0-9]{32}:[a-f0-9]+$/i.test(password)
  );
}



// Decrypt ciphertext back to plaintext
export function decrypt(encrypted) {
  // If no value or not a string, return empty string for safe UI display
  if (!encrypted || typeof encrypted !== 'string') return '';

  // If it doesn't follow the expected IV:Ciphertext format, treat as plaintext
  if (!encrypted.includes(':')) return encrypted;

  try {
    const [ivHex, encryptedHex] = encrypted.split(':');
    if (!ivHex || !encryptedHex) return '';

    const iv = Buffer.from(ivHex, 'hex');
    const encryptedText = Buffer.from(encryptedHex, 'hex');
    const algorithm = 'aes-256-cbc';

    const key = getSecretKey();
    ensureValidKey(key);

    const decipher = crypto.createDecipheriv(algorithm, key, iv);

    const decrypted = Buffer.concat([
      decipher.update(encryptedText),
      decipher.final(),
    ]).toString('utf8');

    return decrypted;
  } catch (err) {
    console.error(`❌ Decryption failed for password entry: ${err && err.message ? err.message : err}`);
    // Return empty string to avoid exposing ciphertext in UI
    return '';
  }
}



const SITE_CATEGORIES = ['General', 'Social', 'Email', 'Finance', 'Shopping', 'Developer', 'Streaming', 'Work', 'Other'];

// Define the schema
const passwordSchema = new mongoose.Schema({
  website: { type: String, required: true, trim: true },
  username: { type: String, required: true, trim: true },
  password: { type: String, required: true },  // holds encrypted data
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  category: { type: String, enum: SITE_CATEGORIES, default: 'General' },
  isFinancial: { type: Boolean, default: false },
  encryptionVersion: { type: String, default: 'AES-256-CBC-v1' },
  notes: { type: String, default: '' },
  expiresAt: { type: Date },
  expireAfterDays: { type: Number, default: 90 },
  lastReminderSent: { type: Date },
  lastChanged: { type: Date, default: Date.now },
  isExpired: { type: Boolean, default: false },
  isBreached: { type: Boolean, default: false },
  breachCount: { type: Number, default: 0 },
  breachCheckedAt: { type: Date, default: null },
  quarantined: { type: Boolean, default: false },
  quarantineReason: { type: String, default: null },
  quarantinedAt: { type: Date, default: null },
  riskScore: { type: Number, default: null },
  riskLevel: { type: String, enum: ['critical', 'high', 'medium', 'low', 'safe', null], default: null },
  riskScoredAt: { type: Date, default: null },
});

export { SITE_CATEGORIES };

// Encrypt password before saving
passwordSchema.pre('save', function (next) {
  if (!this.isModified('password')) return next();

  try {
    if (!isEncrypted(this.password)) {
      this.password = encrypt(this.password);
    }

    const now = new Date();
    this.updatedAt = now;
    this.lastChanged = now;
    this.expiresAt = new Date(
      now.getTime() + this.expireAfterDays * 24 * 60 * 60 * 1000
    );

    next();
  } catch (err) {
    next(err);
  }
});


// Transform to JSON: decrypt password field
passwordSchema.set('toJSON', {
  transform(doc, ret) {
    try {
      ret.isExpired = ret.expiresAt ? new Date() > new Date(ret.expiresAt) : false;

if (ret.expiresAt) {
  const msLeft = new Date(ret.expiresAt) - new Date();
  ret.daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
}
      ret.password = decrypt(ret.password);
    } catch (err) {
      console.error('Error decrypting password:', err);
      ret.password = '';
    }
    // remove internal fields if needed
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model('Password', passwordSchema);
