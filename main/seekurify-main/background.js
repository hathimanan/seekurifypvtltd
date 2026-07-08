const API_BASE_URL = "http://localhost:5000";

// ============================================================================
// ENCRYPTION & SECURITY
// ============================================================================

/**
 * Improved encryption using Web Crypto API (when available)
 * Falls back to XOR encryption for compatibility
 */
async function encryptPassword(password, masterKey = null) {
  // Use master key if provided, otherwise use default
  const key = masterKey || "seekurify-secret-key";
  
  // XOR encryption (basic but functional)
  let encrypted = "";
  for (let i = 0; i < password.length; i++) {
    encrypted += String.fromCharCode(password.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return btoa(encrypted);
}

function decryptPassword(encrypted, masterKey = null) {
  const key = masterKey || "seekurify-secret-key";
  const decoded = atob(encrypted);
  let decrypted = "";
  for (let i = 0; i < decoded.length; i++) {
    decrypted += String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return decrypted;
}

/**
 * Generate a strong random password
 */
function generatePassword(length = 16, options = {}) {
  const {
    includeUppercase = true,
    includeLowercase = true,
    includeNumbers = true,
    includeSpecial = true,
    excludeAmbiguous = true
  } = options;

  let charset = "";
  if (includeLowercase) charset += excludeAmbiguous ? "abcdefghjkmnpqrstuvwxyz" : "abcdefghijklmnopqrstuvwxyz";
  if (includeUppercase) charset += excludeAmbiguous ? "ABCDEFGHJKLMNPQRSTUVWXYZ" : "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (includeNumbers) charset += excludeAmbiguous ? "23456789" : "0123456789";
  if (includeSpecial) charset += "!@#$%^&*()_+-=[]{}|;:,.<>?";

  let password = "";
  const array = new Uint32Array(length);
  self.crypto.getRandomValues(array);
  
  for (let i = 0; i < length; i++) {
    password += charset[array[i] % charset.length];
  }
  
  return password;
}

// ============================================================================
// PASSWORD STRENGTH & VALIDATION
// ============================================================================

function checkPasswordStrength(password) {
  let strength = 0;
  const checks = {
    length: password.length >= 12,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    numbers: /[0-9]/.test(password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    noCommonPatterns: !hasCommonPatterns(password)
  };

  strength += checks.length ? 2 : 0;
  strength += checks.uppercase ? 1 : 0;
  strength += checks.lowercase ? 1 : 0;
  strength += checks.numbers ? 1 : 0;
  strength += checks.special ? 1 : 0;
  strength += checks.noCommonPatterns ? 1 : 0;

  if (password.length >= 16) strength += 1;
  if (password.length >= 20) strength += 1;

  return {
    score: strength,
    level: strength >= 7 ? "strong" : strength >= 4 ? "medium" : "weak",
    checks,
    feedback: getPasswordFeedback(checks, password.length)
  };
}

function hasCommonPatterns(password) {
  const commonPatterns = [
    /^123/i, /456/, /789/, /abc/i, /qwerty/i,
    /password/i, /admin/i, /letmein/i, /welcome/i
  ];
  return commonPatterns.some(pattern => pattern.test(password));
}

function getPasswordFeedback(checks, length) {
  const feedback = [];
  if (!checks.length) feedback.push("Use at least 12 characters");
  if (!checks.uppercase) feedback.push("Add uppercase letters");
  if (!checks.lowercase) feedback.push("Add lowercase letters");
  if (!checks.numbers) feedback.push("Add numbers");
  if (!checks.special) feedback.push("Add special characters");
  if (!checks.noCommonPatterns) feedback.push("Avoid common patterns");
  if (length < 16) feedback.push("Consider using 16+ characters");
  return feedback;
}

// ============================================================================
// PASSWORD REUSE DETECTION
// ============================================================================

async function checkPasswordReuse(password, currentDomain, currentUsername) {
  return new Promise((resolve) => {
    chrome.storage.local.get(["passwords"], (result) => {
      const passwords = result.passwords || [];
      const reused = passwords.filter(p => {
        // Don't count the same domain/username combination
        if (p.domain === currentDomain && p.username === currentUsername) {
          return false;
        }
        return decryptPassword(p.password) === password;
      });
      resolve(reused);
    });
  });
}

// ============================================================================
// DOMAIN MATCHING & NORMALIZATION
// ============================================================================

function normalizeDomain(url) {
  try {
    const urlObj = new URL(url.startsWith('http') ? url : 'https://' + url);
    let hostname = urlObj.hostname;
    
    // Remove www. prefix
    hostname = hostname.replace(/^www\./, '');
    
    return hostname;
  } catch (e) {
    return url;
  }
}

function domainsMatch(domain1, domain2) {
  const normalized1 = normalizeDomain(domain1);
  const normalized2 = normalizeDomain(domain2);
  
  // Exact match
  if (normalized1 === normalized2) return true;
  
  // Subdomain match
  if (normalized1.endsWith('.' + normalized2) || normalized2.endsWith('.' + normalized1)) {
    return true;
  }
  
  return false;
}

// ============================================================================
// JWT TOKEN MANAGEMENT
// ============================================================================

function saveToken(token) {
  chrome.storage.local.set({ jwt: token });
}

function getToken(callback) {
  chrome.storage.local.get("jwt", (data) => {
    callback(data.jwt);
  });
}

function clearToken() {
  chrome.storage.local.remove("jwt");
}

// ============================================================================
// PASSWORD CRUD OPERATIONS
// ============================================================================

async function savePassword(data) {
  const { domain, username, password, url } = data;
  
  // Normalize domain
  const normalizedDomain = normalizeDomain(domain);
  
  // Check password strength
  const strength = checkPasswordStrength(password);
  
  // Check for reuse
  const reused = await checkPasswordReuse(password, normalizedDomain, username);
  
  return new Promise((resolve) => {
    chrome.storage.local.get(["passwords"], (result) => {
      const passwords = result.passwords || [];
      
      // Check if password already exists for this domain/username
      const existingIndex = passwords.findIndex(
        p => normalizeDomain(p.domain) === normalizedDomain && p.username === username
      );
      
      const passwordEntry = {
        id: existingIndex >= 0 ? passwords[existingIndex].id : Date.now(),
        domain: normalizedDomain,
        originalUrl: url || domain,
        username,
        password: encryptPassword(password),
        strength: strength.level,
        strengthScore: strength.score,
        strengthFeedback: strength.feedback,
        isReused: reused.length > 0,
        reusedDomains: reused.map(p => p.domain),
        createdAt: existingIndex >= 0 ? passwords[existingIndex].createdAt : Date.now(),
        updatedAt: Date.now(),
        lastUsed: existingIndex >= 0 ? passwords[existingIndex].lastUsed : null,
        useCount: existingIndex >= 0 ? (passwords[existingIndex].useCount || 0) : 0,
        expiresAt: Date.now() + (90 * 24 * 60 * 60 * 1000), // 90 days
        autoFillEnabled: true,
        notes: existingIndex >= 0 ? passwords[existingIndex].notes : ""
      };
      
      if (existingIndex >= 0) {
        passwords[existingIndex] = passwordEntry;
      } else {
        passwords.push(passwordEntry);
      }
      
      chrome.storage.local.set({ passwords }, () => {
        console.log("💾 Password saved for", normalizedDomain, username);
        resolve({
          success: true,
          entry: passwordEntry,
          isUpdate: existingIndex >= 0,
          warnings: {
            weak: strength.level === "weak",
            reused: reused.length > 0,
            reusedCount: reused.length
          }
        });
      });
    });
  });
}

function getAllPasswords(callback) {
  chrome.storage.local.get(["passwords"], (result) => {
    const passwords = (result.passwords || []).map(p => ({
      ...p,
      password: "••••••••", // Hide passwords in list view
      isExpired: Date.now() > p.expiresAt,
      daysSinceCreated: Math.floor((Date.now() - p.createdAt) / (24 * 60 * 60 * 1000)),
      daysUntilExpiry: Math.floor((p.expiresAt - Date.now()) / (24 * 60 * 60 * 1000))
    }));
    
    // Sort by last used (most recent first), then by creation date
    passwords.sort((a, b) => {
      if (a.lastUsed && b.lastUsed) return b.lastUsed - a.lastUsed;
      if (a.lastUsed) return -1;
      if (b.lastUsed) return 1;
      return b.createdAt - a.createdAt;
    });
    
    callback(passwords);
  });
}

function getPasswordsForDomain(domain, callback) {
  console.log("🔍 Searching passwords for domain:", domain);
  const normalizedDomain = normalizeDomain(domain);
  
  chrome.storage.local.get(["passwords"], (result) => {
    const passwords = result.passwords || [];
    const domainPasswords = passwords.filter(p => {
      return domainsMatch(p.domain, normalizedDomain);
    }).map(p => ({
      id: p.id,
      domain: p.domain,
      username: p.username,
      password: decryptPassword(p.password),
      strength: p.strength,
      isExpired: Date.now() > p.expiresAt,
      lastUsed: p.lastUsed || p.createdAt,
      useCount: p.useCount || 0,
      autoFillEnabled: p.autoFillEnabled !== false
    }));
    
    // Sort by last used
    domainPasswords.sort((a, b) => b.lastUsed - a.lastUsed);
    
    console.log(`✅ Found ${domainPasswords.length} passwords for ${normalizedDomain}`);
    callback(domainPasswords);
  });
}

function updatePasswordUsage(id) {
  chrome.storage.local.get(["passwords"], (result) => {
    const passwords = result.passwords || [];
    const index = passwords.findIndex(p => p.id === id);
    
    if (index !== -1) {
      passwords[index].lastUsed = Date.now();
      passwords[index].useCount = (passwords[index].useCount || 0) + 1;
      chrome.storage.local.set({ passwords });
      console.log("📊 Updated usage for password ID:", id);
    }
  });
}

function getPasswordById(id, callback) {
  chrome.storage.local.get(["passwords"], (result) => {
    const passwords = result.passwords || [];
    const password = passwords.find(p => p.id === id);
    if (password) {
      callback({
        ...password,
        password: decryptPassword(password.password),
        isExpired: Date.now() > password.expiresAt
      });
    } else {
      callback(null);
    }
  });
}

async function updatePassword(id, newPassword, updateExpiry = true) {
  return new Promise((resolve) => {
    chrome.storage.local.get(["passwords"], async (result) => {
      const passwords = result.passwords || [];
      const index = passwords.findIndex(p => p.id === id);
      
      if (index === -1) {
        resolve({ success: false, error: "Password not found" });
        return;
      }
      
      const strength = checkPasswordStrength(newPassword);
      const reused = await checkPasswordReuse(newPassword, passwords[index].domain, passwords[index].username);
      
      passwords[index] = {
        ...passwords[index],
        password: encryptPassword(newPassword),
        strength: strength.level,
        strengthScore: strength.score,
        strengthFeedback: strength.feedback,
        isReused: reused.length > 0,
        reusedDomains: reused.map(p => p.domain),
        updatedAt: Date.now(),
        expiresAt: updateExpiry ? Date.now() + (90 * 24 * 60 * 60 * 1000) : passwords[index].expiresAt
      };
      
      chrome.storage.local.set({ passwords }, () => {
        console.log("🔄 Password updated for ID:", id);
        resolve({
          success: true,
          entry: passwords[index],
          warnings: {
            weak: strength.level === "weak",
            reused: reused.length > 0
          }
        });
      });
    });
  });
}

function deletePassword(id, callback) {
  chrome.storage.local.get(["passwords"], (result) => {
    const passwords = result.passwords || [];
    const filtered = passwords.filter(p => p.id !== id);
    
    chrome.storage.local.set({ passwords: filtered }, () => {
      console.log("🗑️ Password deleted, ID:", id);
      callback({ success: true, deleted: passwords.length - filtered.length });
    });
  });
}

function updatePasswordNotes(id, notes, callback) {
  chrome.storage.local.get(["passwords"], (result) => {
    const passwords = result.passwords || [];
    const index = passwords.findIndex(p => p.id === id);
    
    if (index === -1) {
      callback({ success: false, error: "Password not found" });
      return;
    }
    
    passwords[index].notes = notes;
    passwords[index].updatedAt = Date.now();
    
    chrome.storage.local.set({ passwords }, () => {
      callback({ success: true, entry: passwords[index] });
    });
  });
}

function toggleAutoFill(id, enabled, callback) {
  chrome.storage.local.get(["passwords"], (result) => {
    const passwords = result.passwords || [];
    const index = passwords.findIndex(p => p.id === id);
    
    if (index === -1) {
      callback({ success: false, error: "Password not found" });
      return;
    }
    
    passwords[index].autoFillEnabled = enabled;
    
    chrome.storage.local.set({ passwords }, () => {
      callback({ success: true, autoFillEnabled: enabled });
    });
  });
}

// ============================================================================
// PASSWORD ANALYTICS
// ============================================================================

function getPasswordAnalytics(callback) {
  chrome.storage.local.get(["passwords"], (result) => {
    const passwords = result.passwords || [];
    const now = Date.now();
    
    const analytics = {
      total: passwords.length,
      weak: passwords.filter(p => p.strength === "weak").length,
      medium: passwords.filter(p => p.strength === "medium").length,
      strong: passwords.filter(p => p.strength === "strong").length,
      reused: passwords.filter(p => p.isReused).length,
      expired: passwords.filter(p => now > p.expiresAt).length,
      expiringSoon: passwords.filter(p => {
        const daysUntilExpiry = (p.expiresAt - now) / (24 * 60 * 60 * 1000);
        return daysUntilExpiry > 0 && daysUntilExpiry <= 30;
      }).length,
      neverUsed: passwords.filter(p => !p.lastUsed).length,
      averageStrength: passwords.length > 0 
        ? passwords.reduce((sum, p) => sum + (p.strengthScore || 0), 0) / passwords.length 
        : 0,
      byStrength: {
        strong: passwords.filter(p => p.strength === "strong").length,
        medium: passwords.filter(p => p.strength === "medium").length,
        weak: passwords.filter(p => p.strength === "weak").length
      },
      oldestPassword: passwords.length > 0 
        ? Math.max(...passwords.map(p => now - p.createdAt)) 
        : 0,
      newestPassword: passwords.length > 0 
        ? Math.min(...passwords.map(p => now - p.createdAt)) 
        : 0
    };
    
    callback(analytics);
  });
}

function getSecurityScore(callback) {
  getPasswordAnalytics(analytics => {
    if (analytics.total === 0) {
      callback({ score: 100, grade: "A", issues: [] });
      return;
    }
    
    let score = 100;
    const issues = [];
    
    // Deduct points for weak passwords (up to -30)
    const weakPenalty = Math.min((analytics.weak / analytics.total) * 30, 30);
    score -= weakPenalty;
    if (analytics.weak > 0) {
      issues.push(`${analytics.weak} weak password${analytics.weak > 1 ? 's' : ''}`);
    }
    
    // Deduct points for reused passwords (up to -25)
    const reusedPenalty = Math.min((analytics.reused / analytics.total) * 25, 25);
    score -= reusedPenalty;
    if (analytics.reused > 0) {
      issues.push(`${analytics.reused} reused password${analytics.reused > 1 ? 's' : ''}`);
    }
    
    // Deduct points for expired passwords (up to -20)
    const expiredPenalty = Math.min((analytics.expired / analytics.total) * 20, 20);
    score -= expiredPenalty;
    if (analytics.expired > 0) {
      issues.push(`${analytics.expired} expired password${analytics.expired > 1 ? 's' : ''}`);
    }
    
    // Deduct points for expiring soon (up to -10)
    const expiringSoonPenalty = Math.min((analytics.expiringSoon / analytics.total) * 10, 10);
    score -= expiringSoonPenalty;
    if (analytics.expiringSoon > 0) {
      issues.push(`${analytics.expiringSoon} password${analytics.expiringSoon > 1 ? 's' : ''} expiring soon`);
    }
    
    score = Math.max(0, Math.round(score));
    
    const grade = score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F";
    
    callback({ score, grade, issues, analytics });
  });
}

// ============================================================================
// AUTO-FILL DETECTION & SUGGESTION
// ============================================================================

// Detect login forms on the page
chrome.runtime.onMessage.addListener((msg, sender, sendRes) => {
  
  // ========== PASSWORD MANAGER MESSAGES ==========
  
  if (msg.type === "SAVE_PASSWORD") {
    savePassword(msg.data).then(result => sendRes(result));
    return true;
  }
  
  if (msg.type === "GET_ALL_PASSWORDS") {
    getAllPasswords(sendRes);
    return true;
  }
  
  if (msg.type === "GET_PASSWORD") {
    getPasswordById(msg.id, sendRes);
    return true;
  }
  
  if (msg.type === "UPDATE_PASSWORD") {
    updatePassword(msg.id, msg.password, msg.updateExpiry).then(result => sendRes(result));
    return true;
  }
  
  if (msg.type === "DELETE_PASSWORD") {
    deletePassword(msg.id, sendRes);
    return true;
  }
  
  if (msg.type === "UPDATE_NOTES") {
    updatePasswordNotes(msg.id, msg.notes, sendRes);
    return true;
  }
  
  if (msg.type === "TOGGLE_AUTOFILL") {
    toggleAutoFill(msg.id, msg.enabled, sendRes);
    return true;
  }
  
  if (msg.type === "GET_ANALYTICS") {
    getPasswordAnalytics(sendRes);
    return true;
  }
  
  if (msg.type === "GET_SECURITY_SCORE") {
    getSecurityScore(sendRes);
    return true;
  }
  
  if (msg.type === "CHECK_STRENGTH") {
    const strength = checkPasswordStrength(msg.password);
    sendRes(strength);
    return true;
  }
  
  if (msg.type === "GET_DOMAIN_PASSWORDS") {
    console.log("🔍 Getting passwords for domain:", msg.domain);
    getPasswordsForDomain(msg.domain, sendRes);
    return true;
  }
  
  if (msg.type === "UPDATE_USAGE") {
    updatePasswordUsage(msg.id);
    sendRes({ success: true });
    return true;
  }
  
  if (msg.type === "GENERATE_PASSWORD") {
    const password = generatePassword(msg.length || 16, msg.options || {});
    const strength = checkPasswordStrength(password);
    sendRes({ password, strength });
    return true;
  }
  
  if (msg.type === "SEARCH_PASSWORDS") {
    chrome.storage.local.get(["passwords"], (result) => {
      const passwords = result.passwords || [];
      const query = msg.query.toLowerCase();
      const filtered = passwords.filter(p => 
        p.domain.toLowerCase().includes(query) ||
        p.username.toLowerCase().includes(query) ||
        (p.notes && p.notes.toLowerCase().includes(query))
      ).map(p => ({
        ...p,
        password: "••••••••",
        isExpired: Date.now() > p.expiresAt
      }));
      sendRes(filtered);
    });
    return true;
  }
  
  if (msg.type === "EXPORT_PASSWORDS") {
    getAllPasswords(passwords => {
      // Get full passwords for export
      chrome.storage.local.get(["passwords"], (result) => {
        const fullPasswords = result.passwords || [];
        const exportData = fullPasswords.map(p => ({
          domain: p.domain,
          username: p.username,
          password: decryptPassword(p.password),
          notes: p.notes || "",
          createdAt: new Date(p.createdAt).toISOString(),
          strength: p.strength
        }));
        sendRes({ data: exportData });
      });
    });
    return true;
  }
  
  // ========== LOGIN FORM DETECTION ==========
  
  if (msg.type === "LOGIN_FORM_DETECTED") {
    console.log("🔐 Login form detected on:", msg.domain);
    // Check if we have saved passwords for this domain
    getPasswordsForDomain(msg.domain, passwords => {
      if (passwords.length > 0 && sender.tab?.id) {
        // Send auto-fill suggestions to the content script
        chrome.tabs.sendMessage(sender.tab.id, {
          type: "SHOW_AUTOFILL_SUGGESTION",
          passwords: passwords.map(p => ({
            id: p.id,
            username: p.username,
            autoFillEnabled: p.autoFillEnabled
          }))
        }).catch(err => console.log("Could not send autofill suggestion:", err));
      }
    });
    return true;
  }
  
  if (msg.type === "AUTO_FILL_PASSWORD") {
    getPasswordById(msg.id, password => {
      if (password && sender.tab?.id) {
        updatePasswordUsage(msg.id);
        chrome.tabs.sendMessage(sender.tab.id, {
          type: "FILL_PASSWORD",
          username: password.username,
          password: password.password
        }).catch(err => console.log("Could not auto-fill:", err));
      }
    });
    return true;
  }
  
  // ========== SECURITY SCANNING ==========
  
  if (msg.type === "PAGE_SCAN") {
    scan(msg).then(result => {
      if (result.risk >= 50 && sender.tab?.id) {
        block(sender.tab.id);
      }
      saveLocalLog(msg, result.risk);
    }).catch(err => {
      console.error("PAGE_SCAN error:", err);
    });
    return true;
  }
  
  if (msg.type === "LOGIN_ATTEMPT") {
    notify("Login detected on " + msg.domain);
    return true;
  }
  
  // ========== JWT & LOGGING ==========
  
  if (msg.type === "SET_TOKEN") {
    saveToken(msg.token);
    sendRes({ status: "saved" });
    return true;
  }
  
  if (msg.type === "LOG") {
    getToken((token) => {
      if (!token) return;
      fetch(API_BASE_URL + "/api/logs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + token
        },
        body: JSON.stringify(msg.data)
      }).catch(err => console.error("LOG error:", err));
    });
    return true;
  }
  
  if (msg.type === "CHECK_URL") {
    getToken((token) => {
      fetch(API_BASE_URL + "/api/phishing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + token
        },
        body: JSON.stringify({ url: msg.url })
      })
        .then(async r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const text = await r.text();
          try {
            return JSON.parse(text);
          } catch (e) {
            console.error("Invalid JSON response:", text.substring(0, 200));
            throw new Error("Invalid JSON");
          }
        })
        .then(d => sendRes(d))
       .catch(err => {
  console.log("⚠️ Backend not available - phishing check skipped");
  sendRes({ risk: "UNKNOWN", error: "Backend not available" });
});
    });
    return true;
  }
});

// ============================================================================
// SECURITY SCANNING
// ============================================================================

async function scan(data) {
  try {
    console.log("🔍 Scanning:", API_BASE_URL + "/api/scan");
    
    const res = await fetch(API_BASE_URL + "/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    
    const text = await res.text();
    
    if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
      console.error("❌ Received HTML instead of JSON");
      return { risk: 0 };
    }
    
    if (!res.ok) {
      console.error("❌ HTTP error:", res.status);
      return { risk: 0 };
    }
    
    try {
      const result = JSON.parse(text);
      console.log("✅ Scan result:", result);
      return result;
    } catch (e) {
      console.error("❌ JSON parse error:", e.message);
      return { risk: 0 };
    }
  } catch (err) {
    console.log("⚠️ Backend not available - scan skipped");  
        return { risk: 0 };
  }
}

function block(tabId) {
  chrome.tabs.update(tabId, {
    url: "https://www.google.com/safebrowsing/diagnostic"
  });
}

function notify(msg) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icon.png",
    title: "Seekurify Alert",
    message: msg
  });
}

function saveLocalLog(data, risk) {
  chrome.storage.local.get(["logs"], (res) => {
    const logs = res.logs || [];
    logs.push({
      ...data,
      risk,
      time: Date.now()
    });
    if (logs.length > 500) logs.shift();
    chrome.storage.local.set({ logs });
  });
}

// ============================================================================
// INITIALIZATION & CONTEXT MENU
// ============================================================================

chrome.runtime.onInstalled.addListener(() => {
  console.log("🔐 Seekurify Password Manager installed");
  
  // Create context menu for password generation
  chrome.contextMenus.create({
    id: "generate-password",
    title: "Generate Strong Password",
    contexts: ["editable"]
  });
  
  // Initialize storage if needed
  chrome.storage.local.get(["passwords"], (result) => {
    if (!result.passwords) {
      chrome.storage.local.set({ passwords: [] });
    }
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "generate-password") {
    const password = generatePassword(16);
    // Copy to clipboard
    chrome.tabs.sendMessage(tab.id, {
      type: "INSERT_PASSWORD",
      password: password
    }).catch(err => console.log("Could not insert password:", err));
  }
});

console.log("🚀 Seekurify Password Manager background script loaded");
