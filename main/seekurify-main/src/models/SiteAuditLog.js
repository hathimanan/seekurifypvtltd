import mongoose from 'mongoose';

const findingSchema = new mongoose.Schema(
  {
    severity: { type: String, enum: ['critical', 'warning', 'info'], required: true },
    category: { type: String, required: true },
    message:  { type: String, required: true },
  },
  { _id: false }
);

const siteAuditLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      index: true,
    },
    url:      { type: String, required: true },
    hostname: { type: String, required: true },
    score:    { type: Number, required: true },
    grade:    { type: String, required: true },
    findings: { type: [findingSchema], default: [] },

    // Compact summaries for quick display in history
    ssl: {
      valid:    Boolean,
      grade:    String,
      daysLeft: Number,
      error:    String,
    },
    headers: {
      csp:                Boolean,
      hsts:               Boolean,
      xFrameOptions:      Boolean,
      xContentTypeOptions:Boolean,
      referrerPolicy:     Boolean,
      permissionsPolicy:  Boolean,
      error:              String,
    },
    blacklist: {
      blacklisted: Boolean,
      skipped:     Boolean,
      threats:     [String],
    },
    dns: {
      spf:         Boolean,
      dmarc:       Boolean,
      spfRecord:   String,
      dmarcRecord: String,
    },
    exposedPaths: [
      {
        path:   String,
        status: Number,
        _id:    false,
      },
    ],
    mixedContent: {
      hasMixedContent: Boolean,
      count:           Number,
    },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

// Keep at most 500 logs per user — TTL optional; prune via application logic
siteAuditLogSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('SiteAuditLog', siteAuditLogSchema);
