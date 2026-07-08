import express from "express";
import featureflags from "../models/featureFlag.js";
import { adminAuth } from "../middleware/adminAuth.js";
import User from "../models/User.ts";

const featureFlagRoutes = express.Router();

const USER_TYPE_TIER = {
  individual:            1,
  ai_teams:              2,
  security_professional: 3,
  enterprise:            4,
};

const USER_TYPE_FLAGS = {
  individual: [
    "otp_verification", "pin_verification_password_manager",
    "security_chatbot", "security_awareness", "insights",
    "learn_secure_group",
  ],
  ai_teams: [
    "otp_verification", "pin_verification_password_manager", "password_vault",
    "siem_dashboard", "security_chatbot", "ai_red_team", "ai_agent_scanner",
    "prompt_injection", "pii_detector", "malware_analyzer", "deepfake_detector",
    "ai_security_suite_group", "threat_detection_group",
  ],
  security_professional: [
    "otp_verification", "pin_verification_password_manager", "pin_verification_siem",
    "password_vault", "siem_dashboard", "security_chatbot",
    "malware_analyzer", "deepfake_detector", "phishing_detector",
    "watch_agent", "csp_builder", "site_shield",
    "findings_board", "team_workspaces", "security_awareness",
    "insights", "threat_detection_group",
    "web_infra_group", "teams_group", "learn_secure_group",
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
    key: "threat_detection_group",
    name: "Threat Detection Group",
    description: "Controls visibility of the Threat Detection pillar.",
    enabled: true,
  },
  {
    key: "ai_security_suite_group",
    name: "AI Security Suite Group",
    description: "Controls visibility of the AI Security Suite pillar.",
    enabled: true,
  },
  {
    key: "web_infra_group",
    name: "Web & Infrastructure Group",
    description: "Controls visibility of the Web & Infrastructure pillar.",
    enabled: true,
  },
  {
    key: "teams_group",
    name: "Teams Group",
    description: "Controls visibility of Findings and Team Workspaces.",
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
  {
    key: "pin_verification_siem",
    name: "PIN Verification (SIEM)",
    description: "Require PIN entry before accessing the SIEM dashboard.",
    enabled: false,
  },
  // ── Identity & Access flags ────────────────────────────────────────────────
  {
    key: "password_vault",
    name: "Password Vault",
    description: "Encrypted credential vault with breach detection.",
    enabled: true,
  },
  {
    key: "siem_dashboard",
    name: "SIEM Dashboard",
    description: "System event monitoring and security information dashboard.",
    enabled: true,
  },
  // ── Threat Detection flags ─────────────────────────────────────────────────
  {
    key: "malware_analyzer",
    name: "Malware Analyzer",
    description: "AI-powered malware and suspicious code analysis.",
    enabled: true,
  },
  {
    key: "deepfake_detector",
    name: "DeepFake Detector",
    description: "Detect AI-generated deepfake images and videos.",
    enabled: true,
  },
  {
    key: "phishing_detector",
    name: "Phishing Detector",
    description: "Rule-based and AI phishing email analysis.",
    enabled: false,
  },
  // ── AI Security flags ──────────────────────────────────────────────────────
  {
    key: "ai_red_team",
    name: "AI Red-Team Agent",
    description: "Automated AI-driven attack simulation and red-team testing.",
    enabled: true,
  },
  {
    key: "ai_agent_scanner",
    name: "AI Agent Scanner",
    description: "Scan AI agents and LLM integrations for vulnerabilities.",
    enabled: true,
  },
  {
    key: "prompt_injection",
    name: "AI Injection Scanner",
    description: "Detect prompt injection and jailbreak patterns in AI inputs.",
    enabled: false,
  },
  {
    key: "pii_detector",
    name: "PII Detector (Prompt Privacy Scanner)",
    description: "Identify personally identifiable information in text before it reaches an AI.",
    enabled: true,
  },
  // ── Web & Infrastructure flags ─────────────────────────────────────────────
  {
    key: "watch_agent",
    name: "Watch Agent",
    description: "Real-time monitoring agent for websites and endpoints.",
    enabled: true,
  },
  {
    key: "csp_builder",
    name: "CSP Builder",
    description: "Interactive Content Security Policy generator and validator.",
    enabled: true,
  },
  {
    key: "site_shield",
    name: "SiteShield Audit",
    description: "Full security audit of a domain's headers, SSL, and DNS.",
    enabled: false,
  },
  // ── Team & Collaboration flags ─────────────────────────────────────────────
  {
    key: "findings_board",
    name: "Findings Board",
    description: "Centralised security findings tracker across all modules.",
    enabled: true,
  },
  {
    key: "team_workspaces",
    name: "Team Workspaces",
    description: "Shared workspaces for collaborative security management.",
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
    const pinSIEMFlag = await featureflags.findOne({
      key: "pin_verification_siem",
    });
    const phishingDetectorFlag = await featureflags.findOne({
      key: "phishing_detector",
    });
    const securityChatbotFlag = await featureflags.findOne({
      key: "security_chatbot",
    });
    const siteShieldFlag = await featureflags.findOne({
      key: "site_shield",
    });
    const promptInjectionFlag = await featureflags.findOne({
      key: "prompt_injection",
    });
    const threatDetectionFlag = await featureflags.findOne({
      key: "threat_detection_group",
    });
    const aiSecuritySuiteFlag = await featureflags.findOne({
      key: "ai_security_suite_group",
    });
    const identityAccessFlag = await featureflags.findOne({
      key: "identity_access_group",
    });
    const webInfraFlag = await featureflags.findOne({
      key: "web_infra_group",
    });
    const teamsGroupFlag = await featureflags.findOne({
      key: "teams_group",
    });
    const learnSecureFlag = await featureflags.findOne({
      key: "learn_secure_group",
    });

    const identityAccessEnabled  = identityAccessFlag  ? identityAccessFlag.enabled  : true;
    const threatDetectionEnabled = threatDetectionFlag ? threatDetectionFlag.enabled : true;
    const aiSecuritySuiteEnabled = aiSecuritySuiteFlag ? aiSecuritySuiteFlag.enabled : true;
    const webInfraEnabled        = webInfraFlag        ? webInfraFlag.enabled        : true;
    const teamsEnabled           = teamsGroupFlag      ? teamsGroupFlag.enabled      : true;
    const learnSecureEnabled     = learnSecureFlag     ? learnSecureFlag.enabled     : true;

    res.json({
      otpEnabled: otpFlag ? otpFlag.enabled : true,
      pinVerificationPasswordManager: pinPMFlag ? pinPMFlag.enabled : false,
      pinVerificationSIEM: pinSIEMFlag ? pinSIEMFlag.enabled : false,
      phishingDetectorEnabled:  phishingDetectorFlag  ? phishingDetectorFlag.enabled  : false,
      securityChatbotEnabled:   securityChatbotFlag   ? securityChatbotFlag.enabled   : true,
      siteShieldEnabled:        siteShieldFlag        ? siteShieldFlag.enabled        : false,
      promptInjectionEnabled:   promptInjectionFlag   ? promptInjectionFlag.enabled   : false,
      threatDetectionEnabled,
      aiSecuritySuiteEnabled,
      identityAccessEnabled,
      webInfraEnabled,
      teamsEnabled,
      learnSecureEnabled,
    });
  } catch (err) {
    console.error("Error reading feature flags:", err);
    res.status(500).json({
      otpEnabled: true,
      pinVerificationPasswordManager: false,
      pinVerificationSIEM: false,
      phishingDetectorEnabled: false,
      securityChatbotEnabled: true,
      siteShieldEnabled: false,
      promptInjectionEnabled: false,
      threatDetectionEnabled: false,
      aiSecuritySuiteEnabled: false,
      identityAccessEnabled: false,
      webInfraEnabled: false,
      teamsEnabled: false,
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
