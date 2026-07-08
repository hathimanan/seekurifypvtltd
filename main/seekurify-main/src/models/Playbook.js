import mongoose from 'mongoose';

const playbookStepSchema = new mongoose.Schema({
  order:           { type: Number, required: true },
  action:          {
    type: String,
    required: true,
    enum: ['send_email', 'send_slack', 'send_webhook', 'update_finding', 'create_incident', 'add_note', 'assign_finding', 'trigger_scan', 'push_alert'],
  },
  params:          { type: mongoose.Schema.Types.Mixed, default: {} },
  label:           { type: String, maxlength: 100 },
  continueOnError: { type: Boolean, default: true },
}, { _id: false });

const playbookTriggerSchema = new mongoose.Schema({
  eventType: {
    type: String,
    required: true,
    enum: ['breach_detected', 'risk_score_critical', 'login_anomaly', 'site_degraded', 'finding_opened', 'firewall_threat', 'malware_detected'],
  },
  conditions: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { _id: false });

const playbookSchema = new mongoose.Schema({
  name:          { type: String, required: true, trim: true, maxlength: 120 },
  description:   { type: String, maxlength: 500 },
  enabled:       { type: Boolean, default: true },
  userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  workspaceId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', default: null },
  trigger:       { type: playbookTriggerSchema, required: true },
  steps:         { type: [playbookStepSchema], default: [] },
  runCount:      { type: Number, default: 0 },
  lastRunAt:     { type: Date },
  lastRunStatus: { type: String, enum: ['success', 'partial', 'failed', null], default: null },
}, { timestamps: true });

playbookSchema.index({ userId: 1, enabled: 1 });
playbookSchema.index({ workspaceId: 1, enabled: 1 });
playbookSchema.index({ 'trigger.eventType': 1, enabled: 1 });

export default mongoose.model('Playbook', playbookSchema);
