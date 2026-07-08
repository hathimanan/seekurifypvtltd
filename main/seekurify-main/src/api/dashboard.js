import express from 'express';
import jwt from 'jsonwebtoken';
import { createNotification } from "../utils/createNotification.js";

const dashboardRouter = express.Router();

// Middleware to verify JWT
// Middleware to verify JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    console.error("❌ No Authorization header");
    return res.status(401).json({ error: 'Authorization header missing' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    console.error("❌ Token not found in header");
    return res.status(401).json({ error: 'Token missing in Authorization header' });
  }

  const secret = process.env.JWT_SECRET || process.env.secretKey;

  jwt.verify(token, secret, (err, user) => {
    if (err) {
      console.error("❌ JWT verification failed:", err.message);
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    req.user = user;
    next();
  });
}


// GET /dashboard - Protected route
dashboardRouter.get('/dashboard', authenticateToken, (req, res) => {
  res.json({ message: `Welcome to your dashboard, ${req.user.email}!` });
});

// GET /passwords - Get all passwords for the authenticated user
dashboardRouter.get('/passwords', authenticateToken, (req, res) => {
  const userEmail = req.user.email;
  const passwords = userPasswords[userEmail] || [];
  res.json(passwords);
});

// POST /passwords - Add a new password
dashboardRouter.post('/passwords', authenticateToken, (req, res) => {
  const userEmail = req.user.email;
  const { site, password } = req.body;

  if (!site || !password) {
    return res.status(400).json({ error: 'Site and password are required' });
  }

  const newPassword = {
    id: Date.now().toString(),
    site,
    password
  };

  if (!userPasswords[userEmail]) {
    userPasswords[userEmail] = [];
  }

  userPasswords[userEmail].push(newPassword);
  res.status(201).json(newPassword);
});


// PUT /passwords/:id - Update a password by ID
dashboardRouter.put('/passwords/:id', authenticateToken, async (req, res) => {
  const userEmail = req.user.email;
  const userId = req.user.id; // assuming JWT contains user.id
  const { id } = req.params;
  const { site, password, currentPassword } = req.body;

  const passwords = userPasswords[userEmail] || [];
  const passwordEntry = passwords.find((p) => p.id === id);

  if (!passwordEntry) {
    return res.status(404).json({ error: 'Password not found' });
  }

  try {
    const decryptedStoredPassword = decrypt(passwordEntry.password);

    if (decryptedStoredPassword !== currentPassword) {
      return res.status(403).json({
        error: 'Current password does not match',
        reason: 'incorrect_current_password'
      });
    }

    if (site) passwordEntry.site = site;
    if (password) {
      passwordEntry.password = encrypt(password); // Encrypt new password
      passwordEntry.lastChanged = new Date().toISOString(); // ✅ Update lastChanged
      passwordEntry.updatedAt = new Date().toISOString();   // optional
    }

    // ✅ Trigger notification after password change
    try {
      await createNotification({
        userId,
        message: `🔐 Password for "${site}" was successfully changed.`,
        type: "info",
      });
    } catch (notifyErr) {
      console.error("⚠️ Failed to create notification:", notifyErr);
    }

    res.json(passwordEntry);
  } catch (err) {
    console.error('Error updating password:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// DELETE /passwords/:id - Delete a password by ID
dashboardRouter.delete('/passwords/:id', authenticateToken, (req, res) => {
  const userEmail = req.user.email;
  const { id } = req.params;

  const passwords = userPasswords[userEmail] || [];
  const index = passwords.findIndex((p) => p.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Password not found' });
  }

  passwords.splice(index, 1);
  res.json({ message: 'Password deleted successfully' });
});


export default dashboardRouter;