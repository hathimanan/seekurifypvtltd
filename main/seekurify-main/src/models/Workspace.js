import mongoose from 'mongoose';

const memberSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: ['admin', 'analyst', 'viewer'], default: 'viewer' },
  addedAt: { type: Date, default: Date.now },
}, { _id: false });

const workspaceSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  members: { type: [memberSchema], default: [] },
}, { timestamps: true });

// Indexes for fast member lookups
workspaceSchema.index({ owner: 1 });
workspaceSchema.index({ 'members.userId': 1 });

export default mongoose.model('Workspace', workspaceSchema);
