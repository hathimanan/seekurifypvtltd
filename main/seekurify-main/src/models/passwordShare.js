import mongoose from "mongoose";

/**
 * PasswordShare
 * ---------------
 * Stores client-side encrypted password payloads for one-time or
 * time-limited sharing. The server NEVER decrypts this data.
 */
const passwordShareSchema = new mongoose.Schema(
  {
    // Client-side encrypted payload (Base64 / Hex string)
    encryptedData: {
      type: String,
      required: true,
      trim: true
    },

    // IV used during client-side encryption
    iv: {
      type: String,
      required: true,
      trim: true
    },

    // Optional metadata (NOT sensitive)
    metadata: {
      website: { type: String, trim: true },
      username: { type: String, trim: true }
    },

    // One-time access enforcement
    oneTime: {
      type: Boolean,
      default: true
    },

    used: {
      type: Boolean,
      default: false
    },

    usedAt: {
      type: Date
    },

    // Expiry enforcement
    expiresAt: {
      type: Date,
      required: true
    },

    // Audit / ownership
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    // Optional recipient hint (email / userId) — NOT required for decryption
    recipientHint: {
      type: String,
      trim: true
    },

    // Salt used for PBKDF2 derivation (Base64)
    salt: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

/**
 * TTL index — MongoDB will automatically delete expired shares
 */
passwordShareSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/**
 * Virtual helper — check expiry
 */
passwordShareSchema.virtual("isExpired").get(function () {
  return this.expiresAt && new Date() > this.expiresAt;
});

/**
 * Safe JSON output (never mutate encrypted data)
 */
passwordShareSchema.set("toJSON", {
  transform(doc, ret) {
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model("PasswordShare", passwordShareSchema);
