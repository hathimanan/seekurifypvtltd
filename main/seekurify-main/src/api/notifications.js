import express from 'express';
import jwt from 'jsonwebtoken';
import Notification from '../models/Notification.model.js';

const notificationsRouter = express.Router();

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

// GET /api/notifications
// Returns the 20 most recent notifications for the user, plus unread count.
notificationsRouter.get('/', authenticateToken, async (req, res) => {
  const userId = req.user._id;
  try {
    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ userId })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
      Notification.countDocuments({ userId, read: false }),
    ]);
    res.json({ notifications, unreadCount });
  } catch (err) {
    console.error('GET /notifications error:', err.message);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// GET /api/notifications/unread-count
// Lightweight poll endpoint — just returns the unread count.
notificationsRouter.get('/unread-count', authenticateToken, async (req, res) => {
  const userId = req.user._id;
  try {
    const count = await Notification.countDocuments({ userId, read: false });
    res.json({ count });
  } catch (err) {
    console.error('GET /notifications/unread-count error:', err.message);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

// PATCH /api/notifications/mark-read
// Body: { ids: string[] }  — marks specific notifications as read.
// If ids is omitted or empty, marks ALL unread notifications as read.
notificationsRouter.patch('/mark-read', authenticateToken, async (req, res) => {
  const userId = req.user._id;
  const { ids } = req.body;

  try {
    const filter = ids?.length
      ? { userId, _id: { $in: ids }, read: false }
      : { userId, read: false };

    const result = await Notification.updateMany(filter, { $set: { read: true } });
    res.json({ updated: result.modifiedCount });
  } catch (err) {
    console.error('PATCH /notifications/mark-read error:', err.message);
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
});

export default notificationsRouter;
