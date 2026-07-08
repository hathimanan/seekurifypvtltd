// routes/profile.js

import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.ts'; // Update path as per your project structure
import multer from "multer";

const upload = multer({ storage: multer.memoryStorage() }); // or diskStorage
const router = express.Router();

// ✅ Middleware to authenticate JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // "Bearer <token>"

  if (!token) {
    return res.status(401).json({ error: 'Token missing' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// ✅ GET /api/profile – Get user profile
router.get('/', authenticateToken, async (req, res) => {
  try {
const user = await User.findById(req.user._id).select('name email username profileImage');
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.status(200).json(user);
  } catch (error) {
    console.error('Error fetching profile:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


router.post("/upload-image", authenticateToken, upload.single("profileImage"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    // Example: Convert to Base64 (not scalable for large apps)
    const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: "User not found" });

    user.profileImage = base64Image;
    await user.save();

    res.json({ profileImage: base64Image });
  } catch (err) {
    console.error("Upload image error:", err);
    res.status(500).json({ error: "Failed to upload image" });
  }
});


// routes/profile.js (add this route)
router.put('/', authenticateToken, async (req, res) => {
  const { name, username } = req.body;

  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

if (req.body.profileImage) {
  user.profileImage = req.body.profileImage;
}

    user.name = name || user.name;
    user.username = username || user.username;
    await user.save();


    res.json({
      name: user.name,
      email: user.email,
      username: user.username,
      profileImage: user.profileImage
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


export default router;
