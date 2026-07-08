import mongoose from 'mongoose';

const watchlistItemSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    url:      { type: String, required: true },
    hostname: { type: String, required: true },
    active:   { type: Boolean, default: true },

    // Latest scan result
    lastScore:     { type: Number, default: null },
    lastGrade:     { type: String, default: null },
    lastFindings:  { type: [String], default: [] },
    lastScannedAt: { type: Date, default: null },

    // One-time scheduled scan
    scheduledScanAt: { type: Date, default: null },

    // Previous scan result (for diffing)
    prevScore:    { type: Number, default: null },
    prevGrade:    { type: String, default: null },
    prevFindings: { type: [String], default: [] },
  },
  { timestamps: true }
);

// One URL per user
watchlistItemSchema.index({ userId: 1, url: 1 }, { unique: true });

export default mongoose.model('WatchlistItem', watchlistItemSchema);
