import mongoose from 'mongoose';

const aiAgentScanLogSchema = new mongoose.Schema(
  {
    userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    scanType:    { type: String, enum: ['exfil', 'rag'], required: true },
    endpointUrl: String,
    score:       { type: Number, required: true },
    riskLevel:   { type: String, enum: ['safe', 'low', 'medium', 'high', 'critical'], required: true },
    summary:     String,
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

aiAgentScanLogSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('AIAgentScanLog', aiAgentScanLogSchema);
