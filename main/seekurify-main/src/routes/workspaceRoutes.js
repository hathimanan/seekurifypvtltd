import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import Workspace from '../models/Workspace.js';
import WorkspaceInvite from '../models/WorkspaceInvite.js';
import Password, { encrypt, isEncrypted, decrypt } from '../models/Password.js';
import User from '../models/User.ts';

const router = express.Router();

// ─── Auth middleware ──────────────────────────────────────────────────────────
function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer '))
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  try {
    req.user = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

// Resolve workspace and attach to req.workspace + req.memberRole
async function resolveWorkspace(req, res, next) {
  try {
    const ws = await Workspace.findById(req.params.workspaceId).lean();
    if (!ws) return res.status(404).json({ error: 'Workspace not found' });

    const userId = req.user._id.toString();
    const isOwner = ws.owner.toString() === userId;
    const member = ws.members.find(m => m.userId.toString() === userId);

    if (!isOwner && !member)
      return res.status(403).json({ error: 'You are not a member of this workspace' });

    req.workspace = ws;
    req.memberRole = isOwner ? 'owner' : member.role;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
}

// Role gate factory
function requireRole(...allowed) {
  return (req, res, next) => {
    if (!allowed.includes(req.memberRole))
      return res.status(403).json({ error: `Requires role: ${allowed.join(' or ')}` });
    next();
  };
}

// ─── Workspace CRUD ───────────────────────────────────────────────────────────

// POST /api/workspaces — create workspace
router.post('/workspaces', authenticateToken, async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Workspace name is required' });
  try {
    const ws = await Workspace.create({ name: name.trim(), owner: req.user._id, members: [] });
    res.status(201).json(ws);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create workspace' });
  }
});

// GET /api/workspaces — list workspaces the user owns or belongs to
router.get('/workspaces', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const workspaces = await Workspace.find({
      $or: [{ owner: userId }, { 'members.userId': userId }],
    })
      .populate('owner', 'name email')
      .lean();

    // Annotate each workspace with the caller's role
    const annotated = workspaces.map(ws => {
      const isOwner = ws.owner._id.toString() === userId.toString();
      const member = ws.members.find(m => m.userId.toString() === userId.toString());
      return { ...ws, myRole: isOwner ? 'owner' : member?.role ?? 'viewer' };
    });

    res.json(annotated);
  } catch {
    res.status(500).json({ error: 'Failed to fetch workspaces' });
  }
});

// GET /api/workspaces/:workspaceId — workspace detail with populated members
router.get('/workspaces/:workspaceId', authenticateToken, resolveWorkspace, async (req, res) => {
  try {
    const ws = await Workspace.findById(req.params.workspaceId)
      .populate('owner', 'name email profileImage')
      .populate('members.userId', 'name email profileImage')
      .lean();

    res.json({ ...ws, myRole: req.memberRole });
  } catch {
    res.status(500).json({ error: 'Failed to fetch workspace' });
  }
});

// PUT /api/workspaces/:workspaceId — rename (admin or owner)
router.put(
  '/workspaces/:workspaceId',
  authenticateToken,
  resolveWorkspace,
  requireRole('owner', 'admin'),
  async (req, res) => {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    try {
      const ws = await Workspace.findByIdAndUpdate(
        req.params.workspaceId,
        { name: name.trim() },
        { new: true }
      );
      res.json(ws);
    } catch {
      res.status(500).json({ error: 'Failed to update workspace' });
    }
  }
);

// DELETE /api/workspaces/:workspaceId — owner only
router.delete(
  '/workspaces/:workspaceId',
  authenticateToken,
  resolveWorkspace,
  requireRole('owner'),
  async (req, res) => {
    try {
      await Promise.all([
        Workspace.findByIdAndDelete(req.params.workspaceId),
        Password.deleteMany({ workspaceId: req.params.workspaceId }),
        WorkspaceInvite.deleteMany({ workspaceId: req.params.workspaceId }),
      ]);
      res.json({ message: 'Workspace deleted' });
    } catch {
      res.status(500).json({ error: 'Failed to delete workspace' });
    }
  }
);

// ─── Members ─────────────────────────────────────────────────────────────────

// PUT /api/workspaces/:workspaceId/members/:userId — change role (owner or admin)
router.put(
  '/workspaces/:workspaceId/members/:userId',
  authenticateToken,
  resolveWorkspace,
  requireRole('owner', 'admin'),
  async (req, res) => {
    const { role } = req.body;
    if (!['admin', 'analyst', 'viewer'].includes(role))
      return res.status(400).json({ error: 'Invalid role' });

    const targetId = req.params.userId;
    const ws = req.workspace;

    // Admins cannot promote to owner or demote another admin
    if (req.memberRole === 'admin') {
      const targetMember = ws.members.find(m => m.userId.toString() === targetId);
      if (targetMember?.role === 'admin' && role !== 'admin')
        return res.status(403).json({ error: 'Admins cannot change other admin roles' });
    }

    try {
      const updated = await Workspace.findOneAndUpdate(
        { _id: ws._id, 'members.userId': targetId },
        { $set: { 'members.$.role': role } },
        { new: true }
      );
      if (!updated) return res.status(404).json({ error: 'Member not found' });
      res.json({ message: 'Role updated', role });
    } catch {
      res.status(500).json({ error: 'Failed to update role' });
    }
  }
);

// DELETE /api/workspaces/:workspaceId/members/:userId — remove member
router.delete(
  '/workspaces/:workspaceId/members/:userId',
  authenticateToken,
  resolveWorkspace,
  requireRole('owner', 'admin'),
  async (req, res) => {
    const targetId = req.params.userId;
    const ws = req.workspace;

    if (ws.owner.toString() === targetId)
      return res.status(400).json({ error: 'Cannot remove the workspace owner' });

    // Admins cannot remove other admins
    if (req.memberRole === 'admin') {
      const target = ws.members.find(m => m.userId.toString() === targetId);
      if (target?.role === 'admin')
        return res.status(403).json({ error: 'Admins cannot remove other admins' });
    }

    try {
      await Workspace.findByIdAndUpdate(ws._id, {
        $pull: { members: { userId: targetId } },
      });
      res.json({ message: 'Member removed' });
    } catch {
      res.status(500).json({ error: 'Failed to remove member' });
    }
  }
);

// DELETE /api/workspaces/:workspaceId/leave — leave workspace (non-owner members)
router.delete(
  '/workspaces/:workspaceId/leave',
  authenticateToken,
  resolveWorkspace,
  async (req, res) => {
    if (req.memberRole === 'owner')
      return res.status(400).json({ error: 'Owner cannot leave. Delete the workspace instead.' });
    try {
      await Workspace.findByIdAndUpdate(req.params.workspaceId, {
        $pull: { members: { userId: req.user._id } },
      });
      res.json({ message: 'Left workspace' });
    } catch {
      res.status(500).json({ error: 'Failed to leave workspace' });
    }
  }
);

// ─── Invites ─────────────────────────────────────────────────────────────────

// POST /api/workspaces/:workspaceId/invites — send invite
router.post(
  '/workspaces/:workspaceId/invites',
  authenticateToken,
  resolveWorkspace,
  requireRole('owner', 'admin'),
  async (req, res) => {
    const { email, role = 'viewer' } = req.body;
    if (!email?.trim()) return res.status(400).json({ error: 'Email is required' });
    if (!['admin', 'analyst', 'viewer'].includes(role))
      return res.status(400).json({ error: 'Invalid role' });

    const ws = req.workspace;
    const normalizedEmail = email.trim().toLowerCase();

    // Check already a member
    const existingUser = await User.findOne({ email: normalizedEmail }).lean();
    if (existingUser) {
      const alreadyMember =
        ws.owner.toString() === existingUser._id.toString() ||
        ws.members.some(m => m.userId.toString() === existingUser._id.toString());
      if (alreadyMember)
        return res.status(409).json({ error: 'User is already a member of this workspace' });
    }

    // Check for existing pending invite
    const existing = await WorkspaceInvite.findOne({
      workspaceId: ws._id,
      invitedEmail: normalizedEmail,
      acceptedAt: null,
      expiresAt: { $gt: new Date() },
    });
    if (existing)
      return res.status(409).json({ error: 'A pending invite already exists for this email' });

    try {
      const invite = await WorkspaceInvite.create({
        workspaceId: ws._id,
        invitedEmail: normalizedEmail,
        role,
        invitedBy: req.user._id,
      });
      res.status(201).json({
        message: 'Invite created',
        inviteToken: invite.token,
        inviteLink: `/workspace-invite/${invite.token}`,
        expiresAt: invite.expiresAt,
      });
    } catch {
      res.status(500).json({ error: 'Failed to create invite' });
    }
  }
);

// GET /api/workspaces/:workspaceId/invites — list pending invites (admin/owner)
router.get(
  '/workspaces/:workspaceId/invites',
  authenticateToken,
  resolveWorkspace,
  requireRole('owner', 'admin'),
  async (req, res) => {
    try {
      const invites = await WorkspaceInvite.find({
        workspaceId: req.params.workspaceId,
        acceptedAt: null,
        expiresAt: { $gt: new Date() },
      })
        .populate('invitedBy', 'name email')
        .lean();
      res.json(invites);
    } catch {
      res.status(500).json({ error: 'Failed to fetch invites' });
    }
  }
);

// DELETE /api/workspaces/:workspaceId/invites/:inviteId — revoke invite
router.delete(
  '/workspaces/:workspaceId/invites/:inviteId',
  authenticateToken,
  resolveWorkspace,
  requireRole('owner', 'admin'),
  async (req, res) => {
    try {
      await WorkspaceInvite.findOneAndDelete({
        _id: req.params.inviteId,
        workspaceId: req.params.workspaceId,
      });
      res.json({ message: 'Invite revoked' });
    } catch {
      res.status(500).json({ error: 'Failed to revoke invite' });
    }
  }
);

// GET /api/workspace-invite/:token — get invite info (public, for the landing page)
router.get('/workspace-invite/:token', async (req, res) => {
  try {
    const invite = await WorkspaceInvite.findOne({
      token: req.params.token,
      acceptedAt: null,
      expiresAt: { $gt: new Date() },
    })
      .populate('workspaceId', 'name')
      .populate('invitedBy', 'name email')
      .lean();

    if (!invite) return res.status(404).json({ error: 'Invite not found or expired' });

    res.json({
      workspaceName: invite.workspaceId?.name,
      invitedEmail: invite.invitedEmail,
      role: invite.role,
      invitedBy: invite.invitedBy?.name || invite.invitedBy?.email,
      expiresAt: invite.expiresAt,
    });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/workspace-invite/:token/accept — accept invite (authenticated)
router.post('/workspace-invite/:token/accept', authenticateToken, async (req, res) => {
  try {
    const invite = await WorkspaceInvite.findOne({
      token: req.params.token,
      acceptedAt: null,
      expiresAt: { $gt: new Date() },
    });

    if (!invite) return res.status(404).json({ error: 'Invite not found or expired' });

    const user = await User.findById(req.user._id).lean();
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.email !== invite.invitedEmail)
      return res.status(403).json({
        error: `This invite was sent to ${invite.invitedEmail}. Please log in with that account.`,
      });

    const ws = await Workspace.findById(invite.workspaceId);
    if (!ws) return res.status(404).json({ error: 'Workspace no longer exists' });

    // Check not already a member
    const alreadyMember =
      ws.owner.toString() === user._id.toString() ||
      ws.members.some(m => m.userId.toString() === user._id.toString());

    if (!alreadyMember) {
      ws.members.push({ userId: user._id, role: invite.role });
      await ws.save();
    }

    invite.acceptedAt = new Date();
    await invite.save();

    res.json({ message: 'Joined workspace', workspaceId: ws._id, workspaceName: ws.name });
  } catch {
    res.status(500).json({ error: 'Failed to accept invite' });
  }
});

// ─── Shared Password Vault ────────────────────────────────────────────────────

// GET /api/workspaces/:workspaceId/passwords
router.get('/workspaces/:workspaceId/passwords', authenticateToken, resolveWorkspace, async (req, res) => {
  try {
    const passwords = await Password.find({ workspaceId: req.params.workspaceId })
      .populate('userId', 'name email')
      .lean();

    // toJSON transform not called on .lean(); decrypt manually using top-level import
    const result = passwords.map(p => ({
      ...p,
      password: decrypt(p.password),
      isExpired: p.expiresAt ? new Date() > new Date(p.expiresAt) : false,
      daysLeft: p.expiresAt
        ? Math.ceil((new Date(p.expiresAt) - new Date()) / (1000 * 60 * 60 * 24))
        : null,
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch workspace passwords' });
  }
});

// POST /api/workspaces/:workspaceId/passwords — add (analyst or above)
router.post(
  '/workspaces/:workspaceId/passwords',
  authenticateToken,
  resolveWorkspace,
  requireRole('owner', 'admin', 'analyst'),
  async (req, res) => {
    const { website, username, password, category, notes } = req.body;
    if (!website || !username || !password)
      return res.status(400).json({ error: 'website, username, and password are required' });

    try {
      const entry = await Password.create({
        website,
        username,
        password,
        category: category || 'General',
        notes: notes || '',
        userId: req.user._id,
        workspaceId: req.params.workspaceId,
      });
      res.status(201).json(entry);
    } catch {
      res.status(500).json({ error: 'Failed to add password' });
    }
  }
);

// PUT /api/workspaces/:workspaceId/passwords/:pwdId — update
router.put(
  '/workspaces/:workspaceId/passwords/:pwdId',
  authenticateToken,
  resolveWorkspace,
  requireRole('owner', 'admin', 'analyst'),
  async (req, res) => {
    try {
      const entry = await Password.findOne({
        _id: req.params.pwdId,
        workspaceId: req.params.workspaceId,
      });
      if (!entry) return res.status(404).json({ error: 'Password not found' });

      // Analysts can only edit their own entries
      if (req.memberRole === 'analyst' && entry.userId.toString() !== req.user._id.toString())
        return res.status(403).json({ error: 'Analysts can only edit their own entries' });

      const { website, username, password, category, notes } = req.body;
      if (website) entry.website = website;
      if (username) entry.username = username;
      if (password) entry.password = password;
      if (category) entry.category = category;
      if (notes !== undefined) entry.notes = notes;

      await entry.save();
      res.json(entry);
    } catch {
      res.status(500).json({ error: 'Failed to update password' });
    }
  }
);

// DELETE /api/workspaces/:workspaceId/passwords/:pwdId — delete
router.delete(
  '/workspaces/:workspaceId/passwords/:pwdId',
  authenticateToken,
  resolveWorkspace,
  requireRole('owner', 'admin', 'analyst'),
  async (req, res) => {
    try {
      const entry = await Password.findOne({
        _id: req.params.pwdId,
        workspaceId: req.params.workspaceId,
      });
      if (!entry) return res.status(404).json({ error: 'Password not found' });

      // Analysts can only delete their own entries
      if (req.memberRole === 'analyst' && entry.userId.toString() !== req.user._id.toString())
        return res.status(403).json({ error: 'Analysts can only delete their own entries' });

      await entry.deleteOne();
      res.json({ message: 'Password deleted' });
    } catch {
      res.status(500).json({ error: 'Failed to delete password' });
    }
  }
);

export default router;
