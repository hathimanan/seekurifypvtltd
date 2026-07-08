import mongoose from 'mongoose';

const piiScanLogSchema = new mongoose.Schema(
  {
    userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    label:        { type: String, default: 'Unnamed scan' },
    score:        { type: Number, required: true },
    riskLevel:    { type: String, enum: ['safe', 'low', 'medium', 'high', 'critical'], required: true },
    findingCount: { type: Number, default: 0 },
    summary:      String,
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

piiScanLogSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('PIIScanLog', piiScanLogSchema);
