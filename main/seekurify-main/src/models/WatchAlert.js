import mongoose from 'mongoose';

const watchAlertSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    watchlistItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WatchlistItem',
    },
    url:      { type: String, required: true },
    hostname: { type: String, required: true },

    severity: {
      type: String,
      enum: ['critical', 'high', 'medium', 'low', 'improvement'],
      required: true,
    },

    // Score change
    prevScore: { type: Number, default: null },
    newScore:  { type: Number, required: true },
    scoreDelta: { type: Number, default: 0 },  // negative = degraded

    // Finding diffs
    newFindings:      { type: [String], default: [] },  // appeared since last scan
    resolvedFindings: { type: [String], default: [] },  // fixed since last scan

    // AI-generated human-readable summary
    summary: { type: String, required: true },

    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

watchAlertSchema.index({ userId: 1, createdAt: -1 });
watchAlertSchema.index({ userId: 1, read: 1 });

export default mongoose.model('WatchAlert', watchAlertSchema);
