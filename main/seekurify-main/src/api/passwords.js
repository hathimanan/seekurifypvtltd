import express from 'express';
import crypto from 'crypto';
import jwt  from 'jsonwebtoken';
import Password from '../models/Password.js';
import User from '../models/User.ts';
import bcryptjs from 'bcryptjs';
import { createNotification } from "../utils/createNotification.js";
import Finding from '../models/Finding.js';
const passwordRouter = express.Router();
function getSecretKey() {
  const SECRET_HEX = process.env.PASSWORD_ENCRYPTION_KEY;
  if (SECRET_HEX && /^[0-9a-fA-F]{64}$/.test(SECRET_HEX)) return Buffer.from(SECRET_HEX, 'hex');
  if (process.env.DEV_PASSWORD_ENCRYPTION_KEY && /^[0-9a-fA-F]{64}$/.test(process.env.DEV_PASSWORD_ENCRYPTION_KEY)) return Buffer.from(process.env.DEV_PASSWORD_ENCRYPTION_KEY, 'hex');
  if (process.env.NODE_ENV === 'production') throw new Error('Missing PASSWORD_ENCRYPTION_KEY in environment');
  const devHex = process.env.DEV_PASSWORD_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
  console.warn('⚠️ PASSWORD_ENCRYPTION_KEY is not set. Using a temporary development key. Do NOT use this in production.');
  return Buffer.from(devHex, 'hex');
}

function decrypt(data) {
  if (typeof data !== 'string' || data.indexOf(':') === -1) {
    // Nothing to decrypt or invalid format
    return data;
  }
  
  try {
    const [ivHex, encryptedHex] = data.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const SECRET_KEY = getSecretKey();
    const decipher = crypto.createDecipheriv('aes-256-cbc', SECRET_KEY, iv);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  } catch (error) {
    console.error('Decryption error (passwords route):', error && error.message ? error.message : error);
    // Avoid exposing ciphertext in API responses — return empty string for failed decrypts
    return '';
  }
}

const authenticateToken = (req, res, next) => {



  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};


passwordRouter.post('/', authenticateToken, async (req, res) => {
  const userId = req.user._id; // From verified token
  const { website, username, password, category, isFinancial, notes } = req.body;

  if (!website || !username || !password) {
    return res.status(400).json({ error: "All fields are required." });
  }

  try {
    const newPassword = new Password({
      website,
      username,
      password,
      userId,
      ...(category && { category }),
      isFinancial: isFinancial === true,
      ...(notes !== undefined && { notes }),
    });
    const userP = await User.findById(userId).select('plan');
    if (userP.plan === 'free') {
      const passwordCount = await Password.countDocuments({ userId });
      if (passwordCount >= 3) {
        return res.status(403).json({ 
          error: 'Free plan allows only 3 passwords. Upgrade to premium for unlimited storage.' 
        });
      }
    }
  
    await newPassword.save();

    // Auto-create Finding for weak passwords
    try {
      const pt = password;
      let strength = 0;
      if (/[a-z]/.test(pt)) strength++;
      if (/[A-Z]/.test(pt)) strength++;
      if (/[0-9]/.test(pt)) strength++;
      if (/[^a-zA-Z0-9]/.test(pt)) strength++;

      const severity =
        pt.length < 6 || strength === 0 ? 'critical' :
        pt.length < 8 || strength === 1  ? 'high'     :
        pt.length < 12 || strength === 2 ? 'medium'   : null;

      if (severity) {
        await Finding.findOneAndUpdate(
          { userId, sourceScanId: newPassword._id, category: 'Weak Password' },
          {
            $setOnInsert: {
              title:       `Weak password saved for ${website}`,
              description: `A weak password was saved for "${website}" (username: ${username}). Use at least 12 characters with uppercase, lowercase, numbers, and symbols.`,
              evidence:    `Password length: ${pt.length} chars\nCharacter classes: ${strength}/4`,
              scanType:    'manual',
              sourceUrl:   website,
              status:      'open',
              timeline:    [{ action: 'created', to: 'open', by: userId, at: new Date() }],
            },
            $set: { severity },
          },
          { upsert: true, new: true }
        );
      }
    } catch (findingErr) {
      console.error('Auto-finding (weak password) error:', findingErr.message);
    }

    res.status(201).json({
      _id: newPassword._id,
      website: newPassword.website,
      username: newPassword.username,
      password,
      category: newPassword.category,
      isFinancial: newPassword.isFinancial,
    });
  } catch (error) {
    console.error("Error saving password:", error);
    res.status(500).json({ error: "Server error, please try again." });
  }
});

// 🔐 Retrieve all passwords
passwordRouter.get('/', authenticateToken, async (req, res) => {
  const userId = req.user._id;

  try {
    const passwords = await Password.find({ userId }).lean(); // <-- KEY FIX

    // Compute expires + daysLeft manually after lean()
    const now = new Date();
    const enriched = passwords.map(p => ({
  ...p,
  password: decrypt(p.password), // ✅ FIX: decrypt before sending
  isExpired: p.expiresAt ? now > new Date(p.expiresAt) : false,
  daysLeft: p.expiresAt
    ? Math.ceil((new Date(p.expiresAt) - now) / (1000 * 60 * 60 * 24))
    : null
}));


    res.set('Cache-Control', 'private, max-age=300');
    res.json(enriched);
  } catch (error) {
    console.error("Error retrieving passwords:", error);
    res.status(500).json({ error: "Server error, please try again." });
  }
});


// 🔐 Update a password
// Assuming Express and middleware (like auth) are already in place
passwordRouter.put("/:id", authenticateToken, async (req, res) => {
  const userId = req.user?._id; // Set via auth middleware
  const { website, username, password, currentPassword, category, isFinancial, notes } = req.body;

  if (!currentPassword) {
    return res.status(400).json({ error: "Current password is required." });
  }

  try {
    const entry = await Password.findOne({ _id: req.params.id, userId });

    if (!entry) {
      return res.status(404).json({ error: "Password entry not found." });
    }

    const decryptedStoredPassword = decrypt(entry.password);

    if (decryptedStoredPassword !== currentPassword) {
      return res.status(403).json({
        error: "Current password does not match.",
        reason: "incorrect_current_password",
      });
    }

    // ✅ Update fields (encryption handled in pre('save') middleware)
    entry.website = website ?? entry.website;
    entry.username = username ?? entry.username;
    entry.password = password ?? entry.password;
    if (category !== undefined) entry.category = category;
    if (isFinancial !== undefined) entry.isFinancial = isFinancial === true;
    if (notes !== undefined) entry.notes = notes;

    await entry.save();

    // ✅ Trigger in-app notification after password change
    try {
      await createNotification({
        userId,
        message: `🔐 Password for "${entry.website}" was successfully updated.`,
        type: "info",
      });
    } catch (notifyErr) {
      console.error("⚠️ Failed to create notification:", notifyErr);
    }

    const updatedEntry = {
      ...entry.toObject(),
      password: decrypt(entry.password), // Decrypt before sending to frontend
    };

    res.json(updatedEntry);
  } catch (error) {
    console.error("Error updating password:", error);
    res.status(500).json({ error: "Server error, please try again." });
  }
});



passwordRouter.delete('/:id', authenticateToken, async (req, res) => {
  const userId = req.user._id;
  const { id } = req.params;

  try {
    const entry = await Password.findOneAndDelete({ _id: id, userId });
    if (!entry) {
      return res.status(404).json({ error: 'Password entry not found' });
    }
    return res.json({ message: 'Password deleted successfully' });
  } catch (err) {
    console.error('Error deleting password:', err);
    return res.status(500).json({ error: 'Server error, please try again.' });
  }
});




// ── PATCH /:id/quarantine — lock a credential pending rotation ───────────────
passwordRouter.patch('/:id/quarantine', authenticateToken, async (req, res) => {
  try {
    const entry = await Password.findOne({ _id: req.params.id, userId: req.user._id });
    if (!entry) return res.status(404).json({ error: 'Credential not found' });

    const reason = req.body.reason || 'Manually quarantined — change required';
    entry.quarantined     = true;
    entry.quarantineReason = reason;
    entry.quarantinedAt   = new Date();
    await entry.save();

    res.json({ quarantined: true, _id: entry._id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to quarantine credential' });
  }
});

// ── PATCH /:id/unquarantine — resolve a quarantined credential ───────────────
passwordRouter.patch('/:id/unquarantine', authenticateToken, async (req, res) => {
  try {
    const entry = await Password.findOne({ _id: req.params.id, userId: req.user._id });
    if (!entry) return res.status(404).json({ error: 'Credential not found' });

    entry.quarantined      = false;
    entry.quarantineReason = null;
    entry.quarantinedAt    = null;
    entry.isBreached       = false;
    await entry.save();

    res.json({ unquarantined: true, _id: entry._id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to unquarantine credential' });
  }
});

// ── GET /breach-control — quarantine queue + reuse chains + stats ─────────────
passwordRouter.get('/breach-control', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const all = await Password.find({ userId }).lean();

    // Build SHA-256 hash map to detect reuse
    const hashMap = {};
    for (const p of all) {
      const plain = decrypt(p.password);
      if (!plain) continue;
      const h = crypto.createHash('sha256').update(plain).digest('hex');
      if (!hashMap[h]) hashMap[h] = [];
      hashMap[h].push(p._id.toString());
    }

    // Build reuse chains (groups of ≥2 credentials sharing the same password)
    const reuseChains = [];
    for (const ids of Object.values(hashMap)) {
      if (ids.length < 2) continue;
      const creds = all.filter(p => ids.includes(p._id.toString()));
      reuseChains.push(creds.map(c => ({
        _id: c._id, website: c.website, username: c.username,
        isBreached: c.isBreached, quarantined: c.quarantined,
      })));
    }

    const quarantined = all.filter(p => p.quarantined);
    const breached    = all.filter(p => p.isBreached);

    res.json({
      stats: {
        total:       all.length,
        quarantined: quarantined.length,
        breached:    breached.length,
        reuseChains: reuseChains.length,
        resolved:    all.filter(p => p.isBreached === false && !p.quarantined).length,
      },
      queue: quarantined.map(p => ({
        _id: p._id, website: p.website, username: p.username,
        isBreached: p.isBreached, breachCount: p.breachCount,
        quarantineReason: p.quarantineReason, quarantinedAt: p.quarantinedAt,
      })),
      reuseChains,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load breach control data' });
  }
});

export default passwordRouter;
