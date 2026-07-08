// ============================================================================
// CONTENT SCRIPT - Security Scanning + Password Manager
// ============================================================================




console.log("🔐 Seekurify content script loaded");

let detectedForms = [];
let autoFillOverlay = null;

// ============================================================================
// SAFE MESSAGE SENDING
// ============================================================================

function safeSendMessage(message, callback) {
  try {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        console.log('Extension reloaded - please refresh this page');
        return;
      }
      if (callback) callback(response);
    });
  } catch (error) {
    console.log('Extension reloaded - please refresh this page');
  }
}

// ============================================================================
// TOAST NOTIFICATIONS
// ============================================================================

function showSuccessToast(message) {
  showToast(message, '#10b981');
}

function showWarningToast(message) {
  showToast(message, '#f59e0b');
}

function showToast(message, color) {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    background: ${color};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px;
    animation: slideIn 0.3s ease-out;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => toast.remove(), 3000);
}

// ============================================================================
// SAVE PASSWORD MODAL
// ============================================================================

function showSavePasswordModal(username, password, domain, allowEarlySubmit = false) {
  const existing = document.getElementById('seekurify-save-password-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'seekurify-save-password-modal';
  modal.innerHTML = `
    <style>
      #seekurify-save-password-modal {
        position: fixed;
        top: 20px;
        right: 20px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        padding: 20px;
        z-index: 999999;
        max-width: 350px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        animation: slideIn 0.3s ease-out;
      }
      @keyframes slideIn {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      .sk-modal-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
      }
      .sk-icon {
        width: 40px;
        height: 40px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 20px;
      }
      .sk-title {
        font-size: 16px;
        font-weight: 600;
        color: #1f2937;
        margin: 0;
      }
      .sk-subtitle {
        font-size: 13px;
        color: #6b7280;
        margin: 4px 0 0 0;
      }
      .sk-info {
        background: #f3f4f6;
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 16px;
      }
      .sk-info-row {
        display: flex;
        justify-content: space-between;
        font-size: 13px;
        margin-bottom: 6px;
      }
      .sk-info-row:last-child {
        margin-bottom: 0;
      }
      .sk-label {
        color: #6b7280;
      }
      .sk-value {
        color: #1f2937;
        font-weight: 500;
        max-width: 200px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .sk-countdown {
        text-align: center;
        padding: 8px;
        background: #fef3c7;
        border-radius: 6px;
        margin-bottom: 12px;
        font-size: 12px;
        color: #92400e;
        font-weight: 500;
      }
      .sk-buttons {
        display: flex;
        gap: 8px;
      }
      .sk-btn {
        flex: 1;
        padding: 10px;
        border-radius: 8px;
        border: none;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      }
      .sk-btn-primary {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
      }
      .sk-btn-primary:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
      }
      .sk-btn-secondary {
        background: #f3f4f6;
        color: #6b7280;
      }
      .sk-btn-secondary:hover {
        background: #e5e7eb;
      }
      .sk-btn-continue {
        background: #10b981;
        color: white;
        width: 100%;
        margin-top: 8px;
      }
      .sk-btn-continue:hover {
        background: #059669;
      }
      .sk-close {
        position: absolute;
        top: 12px;
        right: 12px;
        background: none;
        border: none;
        color: #9ca3af;
        cursor: pointer;
        font-size: 20px;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
      }
      .sk-close:hover {
        background: #f3f4f6;
        color: #6b7280;
      }
    </style>
    <button class="sk-close" id="sk-close-btn">×</button>
    <div class="sk-modal-header">
      <div class="sk-icon">🔐</div>
      <div>
        <h3 class="sk-title">Save Password?</h3>
        <p class="sk-subtitle">Seekurify Password Manager</p>
      </div>
    </div>
    <div class="sk-info">
      <div class="sk-info-row">
        <span class="sk-label">Website:</span>
        <span class="sk-value">${escapeHtml(domain)}</span>
      </div>
      <div class="sk-info-row">
        <span class="sk-label">Username:</span>
        <span class="sk-value">${escapeHtml(username)}</span>
      </div>
    </div>
    ${allowEarlySubmit ? '<div class="sk-countdown" id="sk-countdown">Continuing in <span id="sk-timer">10</span> seconds...</div>' : ''}
    <div class="sk-buttons">
      <button class="sk-btn sk-btn-secondary" id="sk-not-now-btn">
        Not Now
      </button>
      <button class="sk-btn sk-btn-primary" id="sk-save-password-btn">
        Save Password
      </button>
    </div>
    ${allowEarlySubmit ? '<button class="sk-btn sk-btn-continue" id="sk-continue-btn">Continue Now →</button>' : ''}
  `;

  document.body.appendChild(modal);

  // Countdown timer if blocking navigation
  let countdownInterval = null;
  if (allowEarlySubmit) {
    let timeLeft = 10;
    const timerElement = document.getElementById('sk-timer');
    
    countdownInterval = setInterval(() => {
      timeLeft--;
      if (timerElement) {
        timerElement.textContent = timeLeft;
      }
      if (timeLeft <= 0) {
        clearInterval(countdownInterval);
      }
    }, 1000);
  }

  // Close button handler
  document.getElementById('sk-close-btn').addEventListener('click', () => {
    if (countdownInterval) clearInterval(countdownInterval);
    modal.remove();
  });

  // Save button handler
  document.getElementById('sk-save-password-btn').addEventListener('click', () => {
    if (countdownInterval) clearInterval(countdownInterval);
    
    safeSendMessage({
      type: "SAVE_PASSWORD",
      data: { domain, username, password, url: location.href }
    }, (response) => {
      if (response && response.success) {
        modal.remove();
        
        // Show warnings if any
        if (response.warnings.weak) {
          showWarningToast("⚠️ Weak password detected. Consider using a stronger password.");
        }
        if (response.warnings.reused) {
          showWarningToast(`⚠️ Password reused on ${response.warnings.reusedCount} other site(s).`);
        }
        
        showSuccessToast("✓ Password saved successfully!");
      }
    });
  });

  // Not now button
  document.getElementById('sk-not-now-btn').addEventListener('click', () => {
    if (countdownInterval) clearInterval(countdownInterval);
    modal.remove();
  });

  // Continue now button (if present)
  const continueBtn = document.getElementById('sk-continue-btn');
  if (continueBtn) {
    continueBtn.addEventListener('click', () => {
      if (countdownInterval) clearInterval(countdownInterval);
      modal.remove();
      // Trigger early form submission
      window.seekurifyEarlySubmit = true;
    });
  }

  // Auto-hide after 10 seconds (only if not blocking navigation)
  if (!allowEarlySubmit) {
    setTimeout(() => {
      if (document.getElementById('seekurify-save-password-modal')) {
        if (countdownInterval) clearInterval(countdownInterval);
        modal.remove();
      }
    }, 10000);
  }
}

function detectFormInjection() {
  const forms = document.querySelectorAll("form");

  forms.forEach((form) => {
    const action = form.action;
    const currentDomain = location.hostname;

    if (action && !action.includes(currentDomain)) {
      showWarningToast("⚠️ Form submits to external domain!");
      
      chrome.runtime.sendMessage({
        type: "FORM_INJECTION_DETECTED",
        action
      });
    }
  });
}


// ============================================================================
// GMAIL MONITORING
// ============================================================================

function isGmail() {
  return location.hostname === "mail.google.com";
}

function extractDomain(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function monitorGmailEmails() {

  if (!isGmail()) return;

  console.log("📡 Gmail phishing monitor started");

  const observer = new MutationObserver(() => {

    const emailBodies = document.querySelectorAll(".a3s");

    emailBodies.forEach(body => {
      if (!body.dataset.seekurifyScanned) {
        body.dataset.seekurifyScanned = "true";
        analyzeEmail(body);
      }
    });

  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}


// ===============================
// 3️⃣ Sender & Header Analysis (Advanced)
// ===============================
async function analyzeSender(emailBody, indicators) {
  // Get sender email and display name
  const senderElement = emailBody.querySelector("span[email]");
  if (!senderElement) return;

  const senderEmail = senderElement.getAttribute("email") || "";
  const senderDomain = senderEmail.split("@")[1] || "";

  // Get display name (the visible name in Gmail)
  const displayName = senderElement.textContent || "";

  // -------------------------------
  // 1️⃣ Brand / Look-Alike Detection
  // -------------------------------
  // Example: Google Security Team vs goog1e@gmail.com
  const suspiciousBrands = ["google", "paypal", "amazon", "microsoft", "bank of america"];
  
  suspiciousBrands.forEach(brand => {
    // If display name contains brand but email domain doesn't match
    if (
      displayName.toLowerCase().includes(brand) &&
      !senderDomain.includes(brand.replace(/\s+/g, "").toLowerCase())
    ) {
      indicators.brandImpersonation = true;
      console.log(`⚠️ Brand impersonation detected: ${displayName} / ${senderEmail}`);
    }

    // Detect simple homograph look-alike attacks (e.g., o → 0, l → 1, i → 1)
    const normalizedEmail = senderEmail.replace(/[01]/g, match => (match === "0" ? "o" : "l"));
    if (normalizedEmail.toLowerCase().includes(brand)) {
      indicators.brandImpersonation = true;
      console.log(`⚠️ Possible look-alike/homograph attack: ${senderEmail}`);
    }
  });

  // -------------------------------
  // 2️⃣ From vs Display Name Mismatch
  // -------------------------------
  // Remove spaces and lowercase
  const cleanDisplay = displayName.replace(/\s+/g, "").toLowerCase();
  const cleanDomain = senderDomain.replace(/\s+/g, "").toLowerCase();

  // If display name has brand but domain is unrelated
  suspiciousBrands.forEach(brand => {
    if (cleanDisplay.includes(brand) && !cleanDomain.includes(brand)) {
      indicators.brandImpersonation = true;
      console.log(`⚠️ Display name mismatch with domain: ${displayName} / ${senderEmail}`);
    }
  });

}




// ============================================================================
// STRICT EMAIL PHISHING DETECTION (LOW FALSE POSITIVE)
// ============================================================================

// ============================================================================
// GOOGLE-ALIGNED PHISHING DETECTION
// Based on Google Mail phishing guidelines
// ============================================================================

async function analyzeEmail(emailBody) {

  let indicators = {
    urgency: false,
    threat: false,
    credentialRequest: false,
    otpHarvest: false,
    genericGreeting: false,
    suspiciousLink: false,
    maliciousDomain: false,
    ipLink: false,
    brandImpersonation: false,
    replyToMismatch: false,
    rewardScam: false,
    deliveryScam: false
  };

  const emailText = emailBody.innerText.toLowerCase();
  const links = emailBody.querySelectorAll("a");

  // ===============================
  // 1️⃣ Content-Based Signals
  // ===============================

const urgencyWords = [
  "urgent", "immediately", "within 24 hours",
  "action required", "as soon as possible",
  "final notice",
  "last warning",
  "limited time",
  "expires today",
  "response needed",
  "act now",
  "time sensitive",
  "important notice",
  "deadline approaching",
  "critical update",
  "security alert",
  "account at risk",
  "verify your account",
  "suspicious activity",
  "unusual activity",
  "enter your password",
  "update your payment",
  "provide your credentials",
  "sign in to avoid interruption"
];


const threatWords = [
  "account suspended",
  "account locked",
  "restricted access",
  "failure",
  "legal action",
  "unauthorized activity",
  "security breach",
  "fraud alert",
  "unusual login attempt",
  "suspicious activity detected",
  "terminated",
  "violation of terms",
  "penalty",
  "permanent closure"
];

const credentialWords = [
  "enter your password",
  "update your payment",
  "provide your credentials",
  "sign in",
  "secure your account",
  "verify your account",
  "login to continue"
];



 const otpWords = [
  "verification code",
  "otp",
  "2-step verification",
  "two factor code",
  "authentication code",
  "one time password",
  "share the code",
  "provide the code",
  "security code",
  "sms code"
];


const genericGreetings = [
  "dear user",
  "dear customer",
  "valued customer",
  "dear member",
  "dear account holder",
  "hello user",
  "dear client",
  "dear subscriber"
];

const rewardWords = [
  "you have won",
  "claim your prize",
  "lottery winner",
  "free gift",
  "cash reward",
  "refund available",
  "tax refund",
  "unexpected payment",
  "compensation",
  "bonus reward",
  "gift card",
  "inheritance",
  "wire transfer"
];


const deliveryWords = [
  "package delivery",
  "tracking number",
  "shipment failed",
  "invoice attached",
  "payment pending",
  "billing statement",
  "order confirmation",
  "delivery attempt failed",
  "customs clearance",
  "shipping update"
];

const financialWords = [
  "bank account", "wire transfer", "credit card", "payment pending", "invoice attached", "loan approval", "funds released", "transfer limit"
];



  urgencyWords.forEach(w => {
    if (emailText.includes(w)) indicators.urgency = true;
  });

  threatWords.forEach(w => {
    if (emailText.includes(w)) indicators.threat = true;
  });

  credentialWords.forEach(w => {
    if (emailText.includes(w)) indicators.credentialRequest = true;
  });

  otpWords.forEach(w => {
    if (emailText.includes(w)) indicators.otpHarvest = true;
  });

  genericGreetings.forEach(w => {
    if (emailText.includes(w)) indicators.genericGreeting = true;
  });

  rewardWords.forEach(w => {
    if (emailText.includes(w)) indicators.rewardScam = true;
  });

  deliveryWords.forEach(w => {
    if (emailText.includes(w)) indicators.deliveryScam = true;
  });

financialWords.forEach(w => {
    if (emailText.includes(w)) indicators.financialScam = true;
  });

  // Detect any sentence like "Click ... to [action]"
if (/\bclick\b.*\b(account|verify|login|secure)\b/.test(emailText)) {
    indicators.credentialRequest = true;
}





  // ===============================
  // 2️⃣ Link Analysis
  // ===============================

const suspiciousTLDs = [
  ".ru",
  ".tk",
  ".xyz",
  ".top",
  ".cn",
  ".gq",
  ".ml",
  ".cf",
  ".ga",
  ".work",
  ".click",
  ".link",
  ".info",
  ".biz",
  ".live",
  ".site",
  ".online",
  ".club",
  ".shop",
  ".icu",
  ".buzz",
  ".rest",
  ".world",
  ".today",
  ".support",
  ".space",
  ".tech",
  ".loan",
  ".win",
  ".vip",
  ".pw",
  ".cam",
  ".monster",
  ".cyou",
  ".email",
  ".digital",
  ".accountant",
  ".party",
  ".science",
  ".men",
  ".country",
  ".stream",
  ".download"
];

  for (const link of links) {

    const href = link.href;
    if (!href) continue;

    const domain = extractDomain(href);
    if (!domain) continue;

    if (href.startsWith("http://")) {
      indicators.suspiciousLink = true;
    }

    if (/https?:\/\/\d+\.\d+\.\d+\.\d+/.test(href)) {
      indicators.ipLink = true;
    }

    suspiciousTLDs.forEach(tld => {
      if (domain.endsWith(tld)) {
        indicators.maliciousDomain = true;
      }
    });

    if (domain.length > 35) {
      indicators.maliciousDomain = true;
    }
  }

  // ===============================
  // 3️⃣ Sender & Header Analysis
  // ===============================

  const senderElement = document.querySelector("span[email]");
  let senderEmail = "";
  let senderDomain = "";

  if (senderElement) {
    senderEmail = senderElement.getAttribute("email") || "";
    senderDomain = senderEmail.split("@")[1] || "";
  }

  // Brand impersonation detection
  if (
    emailText.includes("google") &&
    senderDomain &&
    !senderDomain.includes("google.com")
  ) {
    indicators.brandImpersonation = true;
  }

  // Reply-to mismatch
  const replyToElement = document.querySelector("span[g-email]");
  if (replyToElement) {
    const replyTo = replyToElement.getAttribute("g-email");
    if (replyTo && senderEmail && replyTo !== senderEmail) {
      indicators.replyToMismatch = true;
    }
  }

  // ===============================
  // 4️⃣ STRICT DECISION ENGINE
  // ===============================

  const socialEngineeringPattern =
    indicators.urgency &&
    (indicators.threat || indicators.credentialRequest || indicators.rewardScam || indicators.deliveryScam);


  const technicalSuspicion =
    indicators.suspiciousLink ||
    indicators.maliciousDomain ||
    indicators.ipLink;

  const impersonationAttack =
    indicators.brandImpersonation ||
    indicators.replyToMismatch;

  const otpPhishing =
    indicators.otpHarvest &&
    indicators.credentialRequest;

  const highRisk =
    (socialEngineeringPattern && technicalSuspicion) ||
    (impersonationAttack && technicalSuspicion) ||
    otpPhishing;

  const mediumRisk =
    socialEngineeringPattern ||
    impersonationAttack;

  console.log("📧 Gmail phishing indicators:", indicators);

  // 🔴 HIGH RISK
  if (highRisk) {
    showWarningToast("🚨 HIGH RISK: Possible phishing attempt. Do NOT enter passwords or codes.");
  }

  // 🟡 MEDIUM RISK
  else if (mediumRisk) {
    showWarningToast("⚠️ Suspicious email. Verify sender before clicking links.");
  }

}


// ============================================================================
// FORM DETECTION
// ============================================================================

function detectLoginForms() {
  const forms = document.querySelectorAll('form');
  const potentialLoginForms = [];
  
  forms.forEach(form => {
    const inputs = form.querySelectorAll('input');
    let hasUsername = false;
    let hasPassword = false;
    let usernameField = null;
    let passwordField = null;
    
    inputs.forEach(input => {
      const type = input.type.toLowerCase();
      const name = (input.name || '').toLowerCase();
      const id = (input.id || '').toLowerCase();
      const placeholder = (input.placeholder || '').toLowerCase();
      const autocomplete = (input.autocomplete || '').toLowerCase();
      
      // Detect password field
      if (type === 'password') {
        hasPassword = true;
        passwordField = input;
      }
      
      // Detect username/email field
      if (
        type === 'email' ||
        type === 'text' ||
        autocomplete === 'username' ||
        autocomplete === 'email' ||
        name.includes('user') ||
        name.includes('email') ||
        name.includes('login') ||
        id.includes('user') ||
        id.includes('email') ||
        id.includes('login') ||
        placeholder.includes('user') ||
        placeholder.includes('email') ||
        placeholder.includes('login')
      ) {
        hasUsername = true;
        usernameField = input;
      }
    });
    
    if (hasPassword && hasUsername) {
      potentialLoginForms.push({
        form,
        usernameField,
        passwordField
      });
    }
  });
  
  return potentialLoginForms;
}

function getBaseDomain(hostname) {
  const parts = hostname.split('.');
  if (parts.length >= 2) {
    return parts.slice(-2).join('.');
  }
  return hostname;
}



function checkPendingLogin() {

  const pending = sessionStorage.getItem("seekurify_pending_login");

  if (!pending) return;

  const data = JSON.parse(pending);

  // Only show within 15 seconds (avoid old data)
  if (Date.now() - data.time > 15000) {
    sessionStorage.removeItem("seekurify_pending_login");
    return;
  }

  const currentDomain = location.hostname.replace(/^www\./, '');

  // Ensure same site
  if (!currentDomain.includes(data.domain)) return;

  console.log("✅ Login detected after redirect");

  // Remove immediately (prevent repeat)
  sessionStorage.removeItem("seekurify_pending_login");

  // Show modal
  showSavePasswordModal(
    username,
    password,
    getBaseDomain(currentDomain),
    false
  );
}


// ============================================================================
// AUTO-FILL OVERLAY
// ============================================================================

function createAutoFillOverlay(passwords, usernameField) {
  removeAutoFillOverlay();
  
  const overlay = document.createElement('div');
  overlay.id = 'seekurify-autofill-overlay';
  overlay.style.cssText = `
    position: absolute;
    background: white;
    border: 2px solid #4F46E5;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    min-width: 280px;
    max-width: 400px;
  `;
  
  const rect = usernameField.getBoundingClientRect();
  overlay.style.top = (window.scrollY + rect.bottom + 8) + 'px';
  overlay.style.left = (window.scrollX + rect.left) + 'px';
  
  const header = document.createElement('div');
  header.style.cssText = `
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 12px 16px;
    border-radius: 6px 6px 0 0;
    font-weight: 600;
    font-size: 14px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  `;
  header.innerHTML = `
    <span>🔐 Auto-fill Password</span>
    <button id="seekurify-close-overlay" style="
      background: rgba(255,255,255,0.2);
      border: none;
      color: white;
      cursor: pointer;
      border-radius: 4px;
      padding: 4px 8px;
      font-size: 12px;
    ">✕</button>
  `;
  overlay.appendChild(header);
  
  const list = document.createElement('div');
  list.style.cssText = `max-height: 300px; overflow-y: auto;`;
  
  passwords.forEach((pwd) => {
    const item = document.createElement('div');
    item.className = 'seekurify-password-item';
    item.dataset.passwordId = pwd.id;
    item.style.cssText = `
      padding: 12px 16px;
      border-bottom: 1px solid #e5e7eb;
      cursor: pointer;
      transition: background 0.2s;
    `;
    item.innerHTML = `
      <div style="font-weight: 500; color: #1f2937; margin-bottom: 4px;">
        ${escapeHtml(pwd.username)}
      </div>
      <div style="font-size: 12px; color: #6b7280;">
        Click to auto-fill
      </div>
    `;
    
    item.addEventListener('mouseenter', () => item.style.background = '#f3f4f6');
    item.addEventListener('mouseleave', () => item.style.background = 'white');
    item.addEventListener('click', () => {
      safeSendMessage({ type: 'AUTO_FILL_PASSWORD', id: pwd.id });
      removeAutoFillOverlay();
    });
    
    list.appendChild(item);
  });
  
  overlay.appendChild(list);
  
  const footer = document.createElement('div');
  footer.style.cssText = `
    padding: 8px 16px;
    background: #f9fafb;
    border-radius: 0 0 6px 6px;
    font-size: 11px;
    color: #6b7280;
    text-align: center;
  `;
  footer.textContent = `${passwords.length} saved password${passwords.length !== 1 ? 's' : ''} for this site`;
  overlay.appendChild(footer);
  
  document.body.appendChild(overlay);
  autoFillOverlay = overlay;
  
  document.getElementById('seekurify-close-overlay').addEventListener('click', removeAutoFillOverlay);
  setTimeout(() => document.addEventListener('click', handleOutsideClick), 100);
}

function handleOutsideClick(e) {
  if (autoFillOverlay && !autoFillOverlay.contains(e.target)) {
    removeAutoFillOverlay();
  }
}

function removeAutoFillOverlay() {
  if (autoFillOverlay) {
    autoFillOverlay.remove();
    autoFillOverlay = null;
    document.removeEventListener('click', handleOutsideClick);
  }
}

// ============================================================================
// PASSWORD FILLING
// ============================================================================

function fillPassword(username, password) {
  const forms = detectLoginForms();
  
  if (forms.length === 0) {
    console.log("⚠️ No login forms found");
    return;
  }
  
  const form = forms[0];
  
  if (form.usernameField) {
    form.usernameField.value = username;
    form.usernameField.dispatchEvent(new Event('input', { bubbles: true }));
    form.usernameField.dispatchEvent(new Event('change', { bubbles: true }));
  }
  
  if (form.passwordField) {
    form.passwordField.value = password;
    form.passwordField.dispatchEvent(new Event('input', { bubbles: true }));
    form.passwordField.dispatchEvent(new Event('change', { bubbles: true }));
  }
  
  showSuccessToast("Password auto-filled! ✓");
  highlightField(form.usernameField);
  highlightField(form.passwordField);
}

function highlightField(field) {
  if (!field) return;
  
  const originalBorder = field.style.border;
  const originalBoxShadow = field.style.boxShadow;
  
  field.style.border = '2px solid #10b981';
  field.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
  
  setTimeout(() => {
    field.style.border = originalBorder;
    field.style.boxShadow = originalBoxShadow;
  }, 1500);
}

// ============================================================================
// FORM MONITORING & PASSWORD CAPTURE
// ============================================================================

function monitorForms() {
  const forms = detectLoginForms();
  
  if (forms.length > 0) {
    console.log(`🔍 Detected ${forms.length} login form(s)`);
    
    safeSendMessage({
      type: 'LOGIN_FORM_DETECTED',
      domain: location.hostname.replace(/^www\./, '')
    });
    
    forms.forEach(formData => {
      // Capture on submit and block navigation
 formData.form.addEventListener("submit", () => {

  const username = formData.usernameField?.value?.trim();
  const password = formData.passwordField?.value;

  if (username && password) {

    sessionStorage.setItem(
      "seekurify_pending_login",
      JSON.stringify({
        username,
        password,
        domain: location.hostname,
        time: Date.now()
      })
    );

    console.log("🔐 Login captured, waiting for redirect...");
  }
}, true);

      
      // Add auto-fill on focus
      if (formData.usernameField) {
        formData.usernameField.addEventListener('focus', () => {
          const domain = location.hostname.replace(/^www\./, '');
          safeSendMessage({
            type: 'GET_DOMAIN_PASSWORDS',
            domain
          }, (passwords) => {
            if (passwords && passwords.length > 0) {
              const enabledPasswords = passwords.filter(p => p.autoFillEnabled !== false);
              if (enabledPasswords.length > 0) {
                createAutoFillOverlay(enabledPasswords, formData.usernameField);
              }
            }
          });
        });
      }
    });
  }
}

// ============================================================================
// SECURITY SCANNING (Original functionality)
// ============================================================================

function hasPassword() {
  return !!document.querySelector('input[type="password"]');
}

function hasLoginForm() {
  const forms = document.querySelectorAll("form");
  for (const form of forms) {
    if (
      form.querySelector('input[type="password"]') &&
      (form.querySelector('input[type="email"]') || form.querySelector('input[type="text"]'))
    ) {
      return true;
    }
  }
  return false;
}

function checkPhishing() {


  safeSendMessage(
    {
      type: "CHECK_URL",
      url: location.href
    },
     (risk) => {
  if (risk && risk.level === "HIGH") {
    showWarningToast("🚨 High-risk page detected. Autofill blocked.");
    return;
  }
}
  )
}

function sendPageInfo() {
  console.log("📤 Preparing to send page info for:", location.hostname);
  
  safeSendMessage({
    type: "GET_DOMAIN_PASSWORDS",
    domain: location.hostname
  }, (credentials) => {
    const hasSavedCredentials = credentials && credentials.length > 0;
    const savedUsername = hasSavedCredentials ? credentials[0].username : null;
    
    console.log("🔐 Credential check result:", {
      hasSavedCredentials,
      savedUsername,
      count: credentials ? credentials.length : 0
    });
    
    const scanData = {
      type: "PAGE_SCAN",
      url: location.href,
      domain: location.hostname,
      hasLogin: hasPassword() || hasLoginForm(),
      hasSavedCredentials: hasSavedCredentials,
      savedUsername: savedUsername,
      savedCredentialsCount: credentials ? credentials.length : 0
    };
    
    console.log("📨 Sending PAGE_SCAN message:", scanData);
    safeSendMessage(scanData);
  });
}

function detectSubmit() {
  document.addEventListener("submit", (e) => {
    const form = e.target;
    if (!form || !form.querySelector) return;
    if (form.querySelector('input[type="password"]')) {
      safeSendMessage({
        type: "LOGIN_ATTEMPT",
        domain: location.hostname
      });
    }
  }, true);
}

// ============================================================================
// MESSAGE LISTENERS
// ============================================================================

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'SHOW_AUTOFILL_SUGGESTION') {
    const forms = detectLoginForms();
    if (forms.length > 0 && msg.passwords.length > 0) {
      createAutoFillOverlay(msg.passwords, forms[0].usernameField);
    }
  }
  
  if (msg.type === 'FILL_PASSWORD') {
    fillPassword(msg.username, msg.password);
  }
  
  if (msg.type === 'INSERT_PASSWORD') {
    const activeElement = document.activeElement;
    if (activeElement && activeElement.tagName === 'INPUT') {
      activeElement.value = msg.password;
      activeElement.dispatchEvent(new Event('input', { bubbles: true }));
      showSuccessToast("Password generated! ✓");
    }
  }
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================================================
// INITIALIZATION
// ============================================================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

function init() {
  console.log("🚀 Initializing Seekurify...");
  
  // Password manager features
  monitorForms();
  
  // Security scanning features
  checkPhishing();
  sendPageInfo();
  detectSubmit();
  detectFormInjection();
  monitorGmailEmails();  // this handles email analysis internally
  
  // Re-run form detection on DOM changes (for SPAs)
  const observer = new MutationObserver(() => {
    monitorForms();
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  checkPendingLogin();
}

console.log("✅ Seekurify content script ready");