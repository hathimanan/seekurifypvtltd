// src/data/tips/verifyWebsiteURLs.ts

export const verifyWebsiteURLs = {
  title: "Verify Website URLs Before Entering Personal Information",
  text: "Always check URLs to avoid phishing and identity theft.",
  description: `Cybercriminals frequently create phishing websites that mimic legitimate ones to steal sensitive data like login credentials, bank details, or government IDs. 
These websites often look convincing, but small clues can reveal they are fake. Always double-check the URL before entering personal information to avoid fraud or identity theft.`,
  importance: [
    "Fake websites are a primary tool in phishing campaigns.",
    "Entering your details on compromised sites can lead to stolen identity, drained accounts, or social media takeovers.",
    "Phishing attacks are rising rapidly; verifying links is critical."
  ],
  verificationSteps: [
    "Look for HTTPS and the lock icon in the address bar; avoid HTTP-only sites.",
    "Check for typos or misspellings in domain names (e.g., go0gle.com instead of google.com).",
    "Manually type URLs instead of clicking suspicious links.",
    "Use browser security plugins like HTTPS Everywhere or password managers that flag suspicious URLs.",
    "Cross-check URLs with official sources if unsure."
  ],
  additionalTips: [
    "Bookmark frequently visited websites to avoid errors.",
    "Check SSL certificate details to verify the organization.",
    "Be cautious with shortened URLs; expand them first.",
    "Avoid entering sensitive data on public Wi-Fi unless using a VPN.",
    "Stay updated on new phishing techniques via alerts or trusted blogs."
  ],
  realLifeExample: `In a well-known scam, attackers created a fake banking website with a URL like bankofamerca.com (missing an “i”). Thousands of users entered credentials without noticing the typo, resulting in widespread account takeovers. This underscores the importance of checking URLs before logging in or performing transactions.`,
  finalNote: "Taking a few seconds to verify a website URL can save you from financial loss, identity theft, and privacy breaches. Make URL checking a regular habit."
};

