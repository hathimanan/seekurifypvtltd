// src/data/tips/twoFactorAuth.ts

export const twoFactorAuth = {
  title: "Enable Two-Factor Authentication (2FA)",
  text: "Enable two-factor authentication (2FA) wherever possible.",
  description: `Two-Factor Authentication (2FA) adds a powerful layer of security to your accounts 
by requiring a second verification factor in addition to your password. 
This could be a time-based code, a push notification, or a hardware security key. 
Even if hackers steal your password, they won’t be able to log in without the second factor.`,
  importance: [
    "Significantly reduces the risk of unauthorized access.",
    "Protects sensitive accounts like email, banking, social media, and cloud storage.",
    "Reduces the success rate of phishing, credential stuffing, and brute-force attacks by more than 99%."
  ],
  proTips: [
    "Use app-based authenticators like Google Authenticator, Authy, or Microsoft Authenticator.",
    "Avoid SMS codes when possible, due to SIM swap vulnerabilities.",
    "Enable 2FA on all critical accounts for maximum protection."
  ],
  bestPractices: [
    "Prefer app-based or hardware 2FA over SMS.",
    "Backup recovery codes securely in case you lose your device.",
    "Use different authenticators for personal and work accounts.",
    "Regularly review and update recovery options to avoid lockouts."
  ],
  setupSteps: [
    "Go to your account's Security Settings.",
    "Enable the Two-Factor Authentication option.",
    "Choose your method: app-based, SMS, or hardware key.",
    "Scan the QR code or enter the setup key in your chosen app.",
    "Save your backup codes in a safe, offline location."
  ],
  types: [
    "Authenticator Apps: Time-based codes generated every 30 seconds. Recommended for most users.",
    "SMS Codes: Easy to set up but less secure due to SIM swap vulnerabilities.",
    "Hardware Security Keys: Physical devices like YubiKey or Google Titan for phishing-resistant protection.",
    "Biometric 2FA: Uses fingerprint, face, or voice for added convenience and security."
  ],
  realLifeExample: `In a major 2023 breach, hackers accessed thousands of accounts using leaked passwords. 
Users with 2FA enabled were protected, as attackers couldn't bypass the second verification factor. 
This incident highlights the importance of enabling 2FA across all critical services.`
};
