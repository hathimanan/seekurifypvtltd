import mongoose from 'mongoose';
import crypto from 'crypto';

const workspaceInviteSchema = new mongoose.Schema({
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  invitedEmail: { type: String, required: true, lowercase: true, trim: true },
  role: { type: String, enum: ['admin', 'analyst', 'viewer'], default: 'viewer' },
  token: {
    type: String,
    required: true,
    unique: true,
    default: () => crypto.randomBytes(32).toString('hex'),
  },
  invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  expiresAt: { type: Date, required: true, default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
  acceptedAt: { type: Date },
}, { timestamps: true });

// Auto-delete expired invites
workspaceInviteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
workspaceInviteSchema.index({ workspaceId: 1, invitedEmail: 1 });

export default mongoose.model('WorkspaceInvite', workspaceInviteSchema);
