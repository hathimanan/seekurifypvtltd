import express from "express";
import featureflags from "../models/FeatureFlag.js";
import { adminAuth } from "../middleware/adminAuth.js";
import User from "../models/User.ts";

const featureFlagRoutes = express.Router();

const USER_TYPE_TIER = {
  individual:            1,
  ai_teams:              2,
  security_professional: 3,
  enterprise:            4,
};

// Note: several advanced modules (SIEM, AI Security Suite, SOAR, Watch Agent,
// SiteShield, CSP Builder, Team Workspaces, etc.) have been removed from this
// repo, so the ai_teams/security_professional presets below only reference the
// flags that still exist.
const USER_TYPE_FLAGS = {
  individual: [
    "otp_verification", "pin_verification_password_manager",
    "security_chatbot", "security_awareness", "insights",
    "learn_secure_group",
  ],
  ai_teams: [
    "otp_verification", "pin_verification_password_manager", "password_vault",
    "security_chatbot",
  ],
  security_professional: [
    "otp_verification", "pin_verification_password_manager",
    "password_vault", "security_chatbot",
    "security_awareness", "insights", "learn_secure_group",
  ],
  enterprise: null, // null = all flags
};


const ALL_SEED_FLAGS = [
  // ── Group flags ────────────────────────────────────────────────────────────
  {
    key: "identity_access_group",
    name: "Identity & Access Group",
    description: "Controls visibility of the Identity & Access pillar.",
    enabled: true,
  },
  {
    key: "learn_secure_group",
    name: "Learn & Stay Secure Group",
    description: "Controls visibility of the learning pillar.",
    enabled: true,
  },
  // ── Authentication flags ───────────────────────────────────────────────────
  {
    key: "otp_verification",
    name: "OTP Verification",
    description: "Require one-time password verification on login.",
    enabled: true,
  },
  {
    key: "pin_verification_password_manager",
    name: "PIN Verification (Password Manager)",
    description: "Require PIN entry before viewing vault passwords.",
    enabled: false,
  },
  // ── Identity & Access flags ────────────────────────────────────────────────
  {
    key: "password_vault",
    name: "Password Vault",
    description: "Encrypted credential vault with breach detection.",
    enabled: true,
  },
  // ── Learning & Awareness flags ─────────────────────────────────────────────
  {
    key: "security_awareness",
    name: "Security Awareness",
    description: "Interactive security training and awareness content.",
    enabled: true,
  },
  {
    key: "insights",
    name: "Insights",
    description: "Security trend insights and recommendations.",
    enabled: true,
  },
  {
    key: "security_chatbot",
    name: "Security Chatbot",
    description: "AI assistant for security queries and guidance.",
    enabled: true,
  },
];

async function ensureCoreGroupFlags() {
  await Promise.all(
    ALL_SEED_FLAGS.map((flag) =>
      featureflags.findOneAndUpdate(
        { key: flag.key },
        { $setOnInsert: { ...flag, allowedRoles: ["admin", "user"], rolloutPercentage: 100 } },
        { upsert: true, new: false }
      )
    )
  );
}

// ============================================
// PUBLIC ROUTES FIRST (before any /:key route)
// ============================================

// PUBLIC ENDPOINT - Read feature flags for frontend
// routes/featureFlags.js

featureFlagRoutes.get("/read", async (req, res) => {
  try {
    await ensureCoreGroupFlags();

    const otpFlag = await featureflags.findOne({ key: "otp_verification" });
    const pinPMFlag = await featureflags.findOne({
      key: "pin_verification_password_manager",
    });
    const securityChatbotFlag = await featureflags.findOne({
      key: "security_chatbot",
    });
    const identityAccessFlag = await featureflags.findOne({
      key: "identity_access_group",
    });
    const learnSecureFlag = await featureflags.findOne({
      key: "learn_secure_group",
    });

    const identityAccessEnabled  = identityAccessFlag  ? identityAccessFlag.enabled  : true;
    const learnSecureEnabled     = learnSecureFlag     ? learnSecureFlag.enabled     : true;

    res.json({
      otpEnabled: otpFlag ? otpFlag.enabled : true,
      pinVerificationPasswordManager: pinPMFlag ? pinPMFlag.enabled : false,
      securityChatbotEnabled:   securityChatbotFlag   ? securityChatbotFlag.enabled   : true,
      identityAccessEnabled,
      learnSecureEnabled,
    });
  } catch (err) {
    console.error("Error reading feature flags:", err);
    res.status(500).json({
      otpEnabled: true,
      pinVerificationPasswordManager: false,
      securityChatbotEnabled: true,
      identityAccessEnabled: false,
      learnSecureEnabled: false,
    });
  }
});

// CHECK if feature is enabled (public endpoint with optional user context)
featureFlagRoutes.post("/check", async (req, res) => {
  try {
    const { key, userId } = req.body;

    if (!key) {
      return res.status(400).json({ 
        enabled: false, 
        error: "Key is required" 
      });
    }

    const flag = await featureflags.findOne({ key });

    if (!flag) {
      return res.json({ 
        enabled: false, 
        exists: false 
      });
    }

    // Check rollout percentage (for gradual rollouts)
    let isEnabled = flag.enabled;
    
    if (isEnabled && flag.rolloutPercentage < 100) {
      if (userId) {
        // Use hash of userId for consistent rollout
        const hash = userId.split('').reduce((acc, char) => {
          return ((acc << 5) - acc) + char.charCodeAt(0);
        }, 0);
        isEnabled = (Math.abs(hash) % 100) < flag.rolloutPercentage;
      } else {
        isEnabled = Math.random() * 100 < flag.rolloutPercentage;
      }
    }

    res.json({
      enabled: isEnabled,
      exists: true,
      rolloutPercentage: flag.rolloutPercentage,
      key: flag.key
    });
  } catch (err) {
    console.error("Error checking feature flag:", err);
    res.status(500).json({ 
      enabled: false, 
      error: "Failed to check feature flag" 
    });
  }
});

// ============================================
// ADMIN ROUTES - Specific paths before /:key
// ============================================

// CREATE a flag (admin only)
featureFlagRoutes.post("/create", adminAuth, async (req, res) => {
  try {
    const { key, name, description, enabled, allowedRoles, rolloutPercentage } = req.body;

    // Validation
    if (!key || !name) {
      return res.status(400).json({ 
        success: false, 
        error: "Key and name are required" 
      });
    }

    // Check if flag already exists
    const existingFlag = await featureflags.findOne({ key });
    if (existingFlag) {
      return res.status(409).json({ 
        success: false, 
        error: "Feature flag with this key already exists" 
      });
    }

    const flag = new featureflags({
      key,
      name,
      description,
      enabled: enabled ?? false,
      allowedRoles: allowedRoles ?? ["admin"],
      rolloutPercentage: rolloutPercentage ?? 100
    });

    await flag.save();
    res.status(201).json({ success: true, flag });
  } catch (err) {
    console.error("Error creating flag:", err);
    res.status(500).json({ 
      success: false, 
      error: "Failed to create feature flag" 
    });
  }
});

// TOGGLE/UPDATE flag (admin only)
featureFlagRoutes.post("/toggle", adminAuth, async (req, res) => {
  try {
    const { key, enabled, rolloutPercentage } = req.body;

    // Validation
    if (!key) {
      return res.status(400).json({ 
        success: false, 
        error: "Key is required" 
      });
    }

    // Build update object dynamically
    const updateFields = {};
    if (typeof enabled === "boolean") updateFields.enabled = enabled;
    if (typeof rolloutPercentage === "number" && rolloutPercentage >= 0 && rolloutPercentage <= 100) {
      updateFields.rolloutPercentage = rolloutPercentage;
    }

    const flag = await featureflags.findOneAndUpdate(
      { key },
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    if (!flag) {
      return res.status(404).json({ 
        success: false, 
        error: "Feature flag not found" 
      });
    }

    res.json({ success: true, flag });
  } catch (err) {
    console.error("Error toggling flag:", err);
    res.status(500).json({ 
      success: false, 
      error: "Failed to toggle feature flag" 
    });
  }
});

// UPDATE flag (admin only) - more comprehensive update
featureFlagRoutes.put("/update/:key", adminAuth, async (req, res) => {
  try {
    const { key } = req.params;
    const { name, description, enabled, allowedRoles, rolloutPercentage } = req.body;

    const updateFields = {};
    if (name) updateFields.name = name;
    if (description !== undefined) updateFields.description = description;
    if (typeof enabled === "boolean") updateFields.enabled = enabled;
    if (Array.isArray(allowedRoles)) updateFields.allowedRoles = allowedRoles;
    if (typeof rolloutPercentage === "number") updateFields.rolloutPercentage = rolloutPercentage;

    const flag = await featureflags.findOneAndUpdate(
      { key },
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    if (!flag) {
      return res.status(404).json({ 
        success: false, 
        error: "Feature flag not found" 
      });
    }

    res.json({ success: true, flag });
  } catch (err) {
    console.error("Error updating flag:", err);
    res.status(500).json({ 
      success: false, 
      error: "Failed to update feature flag" 
    });
  }
});

// DELETE flag (admin only)
featureFlagRoutes.delete("/delete/:key", adminAuth, async (req, res) => {
  try {
    const { key } = req.params;

    const flag = await featureflags.findOneAndDelete({ key });

    if (!flag) {
      return res.status(404).json({ 
        success: false, 
        error: "Feature flag not found" 
      });
    }

    res.json({ 
      success: true, 
      message: "Feature flag deleted successfully",
      deletedFlag: flag
    });
  } catch (err) {
    console.error("Error deleting flag:", err);
    res.status(500).json({ 
      success: false, 
      error: "Failed to delete feature flag" 
    });
  }
});

// ============================================
// ADMIN USER-TYPE ROUTES
// ============================================

// GET all users with their current userType (admin only)
featureFlagRoutes.get("/users", adminAuth, async (req, res) => {
  try {
    const users = await User.find({}, "email username name userType ownedFeatureFlags role").sort({ createdAt: -1 });
    // Admins without a stored userType are implicitly enterprise
    const normalized = users.map(u => {
      const obj = u.toObject();
      if (obj.role === 'admin' && !obj.userType) obj.userType = 'enterprise';
      return obj;
    });
    res.json({ success: true, users: normalized });
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ success: false, error: "Failed to fetch users" });
  }
});

// POST assign a userType to a specific user (admin only)
featureFlagRoutes.post("/assign-user-type", adminAuth, async (req, res) => {
  try {
    const { userId, userType } = req.body;

    if (!userId || !userType) {
      return res.status(400).json({ success: false, error: "userId and userType are required" });
    }

    const validTypes = ["individual", "ai_teams", "security_professional", "enterprise"];
    if (!validTypes.includes(userType)) {
      return res.status(400).json({ success: false, error: "Invalid userType" });
    }

    const existingUser = await User.findById(userId).select("userType role");
    if (!existingUser) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    // Resolve ownedFeatureFlags for this type
    let ownedFlags;
    if (userType === "enterprise" || USER_TYPE_FLAGS[userType] === null) {
      // Enterprise gets all known flags
      const allFlags = await featureflags.find({}, "key");
      ownedFlags = allFlags.map(f => f.key);
    } else {
      ownedFlags = USER_TYPE_FLAGS[userType];
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { userType, ownedFeatureFlags: ownedFlags } },
      { new: true, select: "email username name userType ownedFeatureFlags" }
    );

    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    res.json({ success: true, user });
  } catch (err) {
    console.error("Error assigning user type:", err);
    res.status(500).json({ success: false, error: "Failed to assign user type" });
  }
});

// ============================================
// PARAMETERIZED ROUTES LAST
// ============================================

// GET all flags (admin only)
featureFlagRoutes.get("/", adminAuth, async (req, res) => {
  try {
    await ensureCoreGroupFlags();
    const flags = await featureflags.find({}).sort({ createdAt: -1 });
    res.json({ success: true, flags });
  } catch (err) {
    console.error("Error fetching flags:", err);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch feature flags" 
    });
  }
});

// GET specific flag by key (admin only) - MUST BE LAST
featureFlagRoutes.get("/:key", adminAuth, async (req, res) => {
  try {
    const { key } = req.params;
    const flag = await featureflags.findOne({ key });

    if (!flag) {
      return res.status(404).json({ 
        success: false, 
        error: "Feature flag not found" 
      });
    }

    res.json({ success: true, flag });
  } catch (err) {
    console.error("Error fetching flag:", err);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch feature flag" 
    });
  }
});

export default featureFlagRoutes;
