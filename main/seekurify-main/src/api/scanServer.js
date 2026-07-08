import express from "express";
const scanRouter = express.Router();

scanRouter.post("/scan", (req, res) => {
  const { url, domain, hasLogin, hasSavedCredentials, savedUsername } = req.body; // ADDED these two variables
  let risk = 0;
  let reasons = [];

  // Suspicious URL patterns
  if (url.includes("login") || url.includes("signin")) {
    risk += 20;
    reasons.push("Login-related URL");
  }
  if (url.includes("verify") || url.includes("confirm")) {
    risk += 25;
    reasons.push("Verification request");
  }
  if (url.includes("secure") && url.includes("account")) {
    risk += 30;
    reasons.push("Suspicious security claims");
  }
  if (url.includes("free") || url.includes("prize") || url.includes("winner")) {
    risk += 20;
    reasons.push("Reward/prize keywords");
  }
  if (url.includes("urgent") || url.includes("suspend")) {
    risk += 30;
    reasons.push("Urgency tactics");
  }

  // Domain analysis
  if (domain) {
    // Check for suspicious TLDs
    const suspiciousTLDs = ['.tk', '.ml', '.ga', '.cf', '.gq', '.xyz'];
    if (suspiciousTLDs.some(tld => domain.endsWith(tld))) {
      risk += 25;
      reasons.push("Suspicious domain extension");
    }

    // Check for multiple hyphens (common in phishing)
    const hyphenCount = (domain.match(/-/g) || []).length;
    if (hyphenCount >= 2) {
      risk += 20;
      reasons.push("Multiple hyphens in domain");
    }

    // Check for brand impersonation patterns
    const brands = ['paypal', 'amazon', 'google', 'microsoft', 'apple', 'facebook'];
    brands.forEach(brand => {
      if (domain.includes(brand) && !domain.endsWith(`${brand}.com`)) {
        risk += 40;
        reasons.push(`Potential ${brand} impersonation`);
      }
    });

    // Check for IP address instead of domain
    if (/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(domain)) {
      risk += 35;
      reasons.push("IP address used instead of domain");
    }

    // Subdomain depth check
    const parts = domain.split('.');
    if (parts.length > 3) {
      risk += 15;
      reasons.push("Deep subdomain structure");
    }
  }

  // Known test URLs
  if (url.includes("testsafebrowsing.appspot.com") && url.includes("phishing")) {
    risk = 95;
    reasons.push("Known phishing test page");
  }

  // Login form presence with credential check
  if (hasLogin) {
    if (hasSavedCredentials) {
      // User has saved credentials for this domain - likely legitimate
      risk += 5;
      reasons.push("Login form detected (recognized site)");
      
      // Add info about saved credentials
      if (savedUsername) {
        reasons.push(`Saved account found: ${savedUsername}`);
      }
    } else {
      // No saved credentials - potentially suspicious
      risk += 20;
      reasons.push("Login form detected (unrecognized site)");
    }
  }

  // Cap risk at 100
  risk = Math.min(risk, 100);

  // Determine safety level
  let level = "SAFE";
  if (risk >= 70) level = "HIGH_RISK";
  else if (risk >= 50) level = "MEDIUM_RISK";
  else if (risk >= 30) level = "LOW_RISK";

  res.json({
    risk,
    safe: risk < 50,
    level,
    reasons,
    hasSavedCredentials,
    message: risk >= 50 
      ? "⚠️ This site appears suspicious"
      : risk >= 30
      ? "⚡ Proceed with caution"
      : hasSavedCredentials
      ? "✓ Recognized site with saved credentials"
      : "✓ Site appears safe"
  });
});

scanRouter.post("/phishing", (req, res) => {
  const { url } = req.body;
  let risk = "LOW";
  
  if (url.includes("testsafebrowsing") && url.includes("phishing")) {
    risk = "HIGH";
  }
  if (url.includes("verify") || url.includes("confirm")) {
    risk = "MEDIUM";
  }
  if (url.includes("login") && url.includes("secure")) {
    risk = "HIGH";
  }
  
  res.json({
    risk,
    url,
    safe: risk === "LOW"
  });
});

scanRouter.post("/logs", (req, res) => {
  console.log("Activity log:", req.body);
  res.json({ success: true });
});

export default scanRouter;