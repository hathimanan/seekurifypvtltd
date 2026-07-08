import mongoose from 'mongoose';

const { Schema, Types: { ObjectId } } = mongoose;

const firewallEventSchema = new Schema({
  userId:        { type: ObjectId, ref: 'User', required: true },
  workspaceId:   { type: ObjectId, ref: 'Workspace', default: null },

  sourceIp:      { type: String, maxlength: 50 },
  targetUrl:     { type: String, maxlength: 1000 },
  userAgent:     { type: String, maxlength: 500 },
  requestBody:   { type: String, maxlength: 5000 },
  headers:       { type: Schema.Types.Mixed, default: {} },

  matchedRuleId:   { type: ObjectId, ref: 'FirewallRule', default: null },
  matchedRuleName: { type: String, default: null },

  aiThreatType:     { type: String, maxlength: 100 },
  aiSeverity:       { type: String, enum: ['critical', 'high', 'medium', 'low', 'none', null], default: null },
  aiConfidence:     { type: Number, min: 0, max: 1, default: null },
  aiRecommendation: { type: String, maxlength: 1000 },
  aiIndicators:     { type: [String], default: [] },

  verdict:   { type: String, enum: ['block', 'allow', 'monitor'], required: true },
  findingId: { type: ObjectId, ref: 'Finding', default: null },
}, { timestamps: true });

firewallEventSchema.index({ userId: 1, createdAt: -1 });
firewallEventSchema.index({ userId: 1, verdict: 1, createdAt: -1 });
firewallEventSchema.index({ userId: 1, aiSeverity: 1, createdAt: -1 });
firewallEventSchema.index({ matchedRuleId: 1 });

export default mongoose.model('FirewallEvent', firewallEventSchema);
