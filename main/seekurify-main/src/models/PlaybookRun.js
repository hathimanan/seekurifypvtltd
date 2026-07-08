import mongoose from 'mongoose';

const stepResultSchema = new mongoose.Schema({
  order:       { type: Number, required: true },
  action:      { type: String, required: true },
  label:       { type: String },
  status:      { type: String, enum: ['success', 'skipped', 'failed'], required: true },
  output:      { type: String, maxlength: 2000 },
  error:       { type: String, maxlength: 2000 },
  durationMs:  { type: Number },
  executedAt:  { type: Date, default: Date.now },
}, { _id: false });

const playbookRunSchema = new mongoose.Schema({
  playbookId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Playbook', required: true },
  userId:            { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  workspaceId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', default: null },
  triggerEventType:  { type: String, required: true },
  triggerPayload:    { type: mongoose.Schema.Types.Mixed },
  status:            { type: String, enum: ['running', 'success', 'partial', 'failed'], default: 'running' },
  stepResults:       { type: [stepResultSchema], default: [] },
  startedAt:         { type: Date, default: Date.now },
  completedAt:       { type: Date },
  durationMs:        { type: Number },
  relatedFindingId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Finding', default: null },
  relatedIncidentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Incident', default: null },
}, { timestamps: true });

playbookRunSchema.index({ playbookId: 1, createdAt: -1 });
playbookRunSchema.index({ userId: 1, createdAt: -1 });
playbookRunSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('PlaybookRun', playbookRunSchema);
