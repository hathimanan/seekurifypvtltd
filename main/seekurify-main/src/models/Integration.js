import mongoose from 'mongoose';

const integrationSchema = new mongoose.Schema({
  userId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  workspaceId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', default: null },
  name:            { type: String, required: true, trim: true, maxlength: 80 },
  type:            { type: String, required: true, enum: ['slack', 'jira', 'webhook'] },
  enabled:         { type: Boolean, default: true },
  config:          { type: mongoose.Schema.Types.Mixed, required: true },
  lastTestedAt:    { type: Date },
  lastTestStatus:  { type: String, enum: ['ok', 'failed', null], default: null },
  lastTestMessage: { type: String, maxlength: 500 },
}, { timestamps: true });

integrationSchema.index({ userId: 1, type: 1 });

export default mongoose.model('Integration', integrationSchema);
