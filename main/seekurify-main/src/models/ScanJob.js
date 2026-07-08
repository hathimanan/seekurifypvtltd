import mongoose from 'mongoose';

const scanFindingSchema = new mongoose.Schema({
  passwordId: { type: String },
  website:    { type: String },
  username:   { type: String },
  type:       { type: String, enum: ['breach', 'risk_score'] },
  level:      { type: String },
  score:      { type: Number },
  breachCount:{ type: Number },
}, { _id: false });

const scanJobSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type:      { type: String, enum: ['breach_check', 'risk_score', 'both'], default: 'both' },
  trigger:   { type: String, enum: ['scheduled', 'manual'], default: 'scheduled' },
  status:    { type: String, enum: ['running', 'completed', 'failed'], default: 'running' },
  startedAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
  durationMs:  { type: Number },
  summary: {
    credentialsChecked: { type: Number, default: 0 },
    breachedFound:      { type: Number, default: 0 },
    criticalFound:      { type: Number, default: 0 },
    highFound:          { type: Number, default: 0 },
    mediumFound:        { type: Number, default: 0 },
    playbooksTriggered: { type: Number, default: 0 },
  },
  findings: { type: [scanFindingSchema], default: [] },
  error:     { type: String },
}, { timestamps: true });

scanJobSchema.index({ userId: 1, createdAt: -1 });
scanJobSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('ScanJob', scanJobSchema);
