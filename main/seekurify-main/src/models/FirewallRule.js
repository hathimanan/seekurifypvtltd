import mongoose from 'mongoose';

const { Schema, Types: { ObjectId } } = mongoose;

const firewallRuleSchema = new Schema({
  userId:          { type: ObjectId, ref: 'User', required: true },
  workspaceId:     { type: ObjectId, ref: 'Workspace', default: null },
  name:            { type: String, required: true, trim: true, maxlength: 120 },
  description:     { type: String, maxlength: 500 },
  type: {
    type: String,
    required: true,
    enum: ['ip_block', 'ip_allow', 'url_pattern', 'user_agent', 'payload_pattern'],
  },
  action:          { type: String, enum: ['block', 'allow', 'log'], required: true },
  value:           { type: String, required: true, maxlength: 500 },
  severity:        { type: String, enum: ['critical', 'high', 'medium', 'low'], required: true },
  enabled:         { type: Boolean, default: true },
  hitCount:        { type: Number, default: 0 },
  lastTriggeredAt: { type: Date, default: null },
}, { timestamps: true });

firewallRuleSchema.index({ userId: 1, enabled: 1 });
firewallRuleSchema.index({ userId: 1, type: 1 });
firewallRuleSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('FirewallRule', firewallRuleSchema);
