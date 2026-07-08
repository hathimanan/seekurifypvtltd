import mongoose from 'mongoose';

const deviceFingerprintSchema = new mongoose.Schema({
  userId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fingerprintHash: { type: String, required: true },
  userAgent:       { type: String },
  label:           { type: String },
  firstSeen:       { type: Date, default: Date.now },
  lastSeen:        { type: Date, default: Date.now },
});

deviceFingerprintSchema.index({ userId: 1, fingerprintHash: 1 }, { unique: true });

export default mongoose.model('DeviceFingerprint', deviceFingerprintSchema);
