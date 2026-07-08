import mongoose from 'mongoose';

const timelineEntrySchema = new mongoose.Schema({
  action: { type: String, required: true },          // 'created', 'status_changed', 'assigned', 'note_added', 'severity_changed'
  from: { type: String },                             // Previous value (for status/severity changes)
  to: { type: String },                               // New value
  note: { type: String, maxlength: 1000 },
  by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  at: { type: Date, default: Date.now },
}, { _id: false });

const findingSchema = new mongoose.Schema({
  // Core identification
  title: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, maxlength: 4000 },
  evidence: { type: String, maxlength: 2000 },        // Payload, matched text, or proof from scan

  // Severity & classification
  severity: {
    type: String,
    enum: ['critical', 'high', 'medium', 'low', 'info'],
    required: true,
  },
  category: { type: String, trim: true, maxlength: 100 }, // 'SQL Injection', 'Missing HSTS', 'Role Override', etc.

  // Status tracking
  status: {
    type: String,
    enum: ['open', 'acknowledged', 'in_progress', 'to_be_retested', 'resolved', 'ignored'],
    default: 'open',
  },
  resolvedAt: { type: Date },
  dueDate: { type: Date },

  // Ownership & assignment
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Creator
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', default: null },

  // Source scan reference (populated when converting a scan result)
  scanType: {
    type: String,
    enum: ['redteam', 'injection', 'siteaudit', 'pii', 'aiagent', 'manual', 'waf'],
    default: 'manual',
  },
  sourceScanId: { type: mongoose.Schema.Types.ObjectId, default: null },  // ID of the scan log
  sourceUrl: { type: String, maxlength: 500 },                            // URL that was scanned

  // Remediation
  remediationNotes: { type: String, maxlength: 4000 },
  fixSnippet: { type: String, maxlength: 4000 },     // Code or config snippet to fix

  // Full change history
  timeline: { type: [timelineEntrySchema], default: [] },
}, { timestamps: true });

// Indexes for fast dashboard queries
findingSchema.index({ userId: 1, status: 1, createdAt: -1 });
findingSchema.index({ workspaceId: 1, status: 1, createdAt: -1 });
findingSchema.index({ assignedTo: 1, status: 1 });
findingSchema.index({ severity: 1, status: 1 });
findingSchema.index({ sourceScanId: 1 });

export default mongoose.model('Finding', findingSchema);
