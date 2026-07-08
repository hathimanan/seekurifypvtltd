import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.ts'; // adjust path as needed

const router = express.Router();
const secretKey = process.env.JWT_SECRET;
if (!secretKey) throw new Error('Missing required env var: JWT_SECRET');

// Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized: No token provided' });

  jwt.verify(token, secretKey, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

// GET /api/homepageAfterLogin
router.get('/homepageAfterLogin', authenticateToken, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const userId = req.user._id;

    // 🔐 Fetch user from DB
    const user = await User.findOne({ _id: userId, email: userEmail });

    if (!user) return res.status(404).json({ error: 'User not found' });

    const dashboardInfo = {
      message: `Welcome to Seekurify dashboard, ${user.email}!`,
      features: [
        'Analyze Malware',
        'Password Manager',
        'SIEM Dashboard',
        'Security Awareness Tools'
      ],
      user: {
        email: user.email,
        id: user._id
      },
 // ✅ Your modal trigger
      alerts: [
        { type: 'malware-scan', status: 'All clear', timestamp: new Date() },
        { type: 'system-health', status: 'Optimal', timestamp: new Date() }
      ]
    };

    router.get('/profile-icon/:userId', async (req, res) => {
  const user = await User.findById(req.params.userId);
  if (user?.profileIcon) {
    res.sendFile(path.resolve(user.profileIcon));
  } else {
    res.status(404).json({ error: 'Profile icon not found' });
  }
});

    res.status(200).json(dashboardInfo);
  } catch (error) {
    console.error('Error in /homepageAfterLogin:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
