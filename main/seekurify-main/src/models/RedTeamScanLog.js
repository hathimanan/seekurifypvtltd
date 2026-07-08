import mongoose from 'mongoose';

const findingSchema = new mongoose.Schema({
  category:    { type: String },
  severity:    { type: String, enum: ['critical', 'high', 'medium', 'low'] },
  succeeded:   { type: Boolean, default: false },
  payload:     { type: String },
  evidence:    { type: String },
  description: { type: String },
  timestamp:   { type: Date, default: Date.now },
}, { _id: false });

const stepSchema = new mongoose.Schema({
  step:        { type: Number },
  tool:        { type: String },
  description: { type: String },
  category:    { type: String },
  severity:    { type: String },
  timestamp:   { type: Date, default: Date.now },
}, { _id: false });

const redTeamScanSchema = new mongoose.Schema({
  userId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  targetUrl:       { type: String, required: true },
  requestFormat:   { type: String, default: 'openai' },
  status:          { type: String, enum: ['running', 'completed', 'failed'], default: 'running' },
  score:           { type: Number },
  riskLevel:       { type: String, enum: ['critical', 'high', 'medium', 'low', 'clean'] },
  findings:        [findingSchema],
  steps:           [stepSchema],
  summary:         { type: String },
  recommendations: [{ type: String }],
  totalProbes:     { type: Number, default: 0 },
  successfulAttacks: { type: Number, default: 0 },
  duration:        { type: Number },  // ms
}, { timestamps: true });

export default mongoose.model('RedTeamScanLog', redTeamScanSchema);
