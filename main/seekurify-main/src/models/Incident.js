import mongoose from 'mongoose';

const incidentTimelineSchema = new mongoose.Schema({
  action: { type: String, required: true },
  from:   { type: String },
  to:     { type: String },
  note:   { type: String, maxlength: 1000 },
  by:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  at:     { type: Date, default: Date.now },
}, { _id: false });

const incidentSchema = new mongoose.Schema({
  title:            { type: String, required: true, trim: true, maxlength: 200 },
  description:      { type: String, maxlength: 4000 },
  severity:         { type: String, enum: ['critical', 'high', 'medium', 'low'], required: true },
  status:           { type: String, enum: ['open', 'investigating', 'contained', 'resolved', 'closed'], default: 'open' },
  userId:           { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  workspaceId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', default: null },
  assignedTo:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  findingIds:       [{ type: mongoose.Schema.Types.ObjectId, ref: 'Finding' }],
  triggerEventType: { type: String },
  triggerPayload:   { type: mongoose.Schema.Types.Mixed },
  category:         { type: String, maxlength: 100 },
  dueDate:          { type: Date },
  resolvedAt:       { type: Date },
  timeline:         { type: [incidentTimelineSchema], default: [] },
  playbookRunIds:   [{ type: mongoose.Schema.Types.ObjectId, ref: 'PlaybookRun' }],
}, { timestamps: true });

incidentSchema.index({ userId: 1, status: 1, createdAt: -1 });
incidentSchema.index({ workspaceId: 1, status: 1, createdAt: -1 });
incidentSchema.index({ severity: 1, status: 1 });
incidentSchema.index({ assignedTo: 1, status: 1 });

export default mongoose.model('Incident', incidentSchema);
