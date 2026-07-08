import crypto from 'crypto';
import mongoose from 'mongoose';

const scannerApiKeySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    keyPrefix: {
      type: String,
      required: true,
      index: true,
    },
    keyHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    last4: {
      type: String,
      required: true,
    },
    scopes: {
      type: [String],
      default: ['injection-scan'],
    },
    lastUsedAt: {
      type: Date,
      default: null,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

scannerApiKeySchema.statics.hashKey = function hashKey(rawKey) {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
};

const ScannerApiKey = mongoose.model('ScannerApiKey', scannerApiKeySchema);

export default ScannerApiKey;
