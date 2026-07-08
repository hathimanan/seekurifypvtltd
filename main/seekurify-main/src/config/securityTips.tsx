interface Tip {
  title: string;
  text: string;
  description: string;
  importance?: string[];
  proTips?: string[];
  bestPractices?: string[];
  realLifeExample?: string;
  quickTip?: string;
  howTo?: string[];            // actionable steps
  signs?: string[];           // signs something is wrong
  tools?: string[];           // recommended tools/resources
  recoverySteps?: string[];   // post-incident recovery guidance
  reference?: string[];         // external reference link
}

export const tips: Tip[] = [

  {
    title: "Use Strong, Unique Passwords",
    text: "Create strong, unique passwords for each account.",
    description: `Passwords remain the primary gatekeeper for most online accounts. A strong password combined with careful management vastly reduces the chance of account takeover.`,
    importance: [
      "Stops credential stuffing from reused passwords.",
      "Makes brute-force attacks infeasible with longer, complex passphrases.",
      "Protects linked services (email, password managers) from cascading compromises.",
      "Reduces the impact of a single service breach."
    ],
    proTips: [
      "Prefer long passphrases (14+ characters) composed of multiple words and separators.",
      "Use a reputable password manager (Bitwarden, 1Password, KeePassXC) to generate and store unique credentials.",
      "Enable auto-fill only on trusted devices and browsers.",
      "Avoid dictionary words and predictable patterns."
    ],
    bestPractices: [
      "Never reuse passwords across important accounts (email, banking, work).",
      "Rotate credentials after confirmed breaches or temporary sharing.",
      "Store passwords in an encrypted password manager instead of notes or files.",
      "Audit passwords quarterly to find weak or compromised ones."
    ],
    howTo: [
      "Install a password manager and import existing credentials.",
      "Run the manager's audit to find weak/duplicate passwords and replace them.",
      "Create long passphrases or use the generator for new accounts.",
      "Enable autofill only on secure devices."
    ],
    signs: [
      "Unexpected password reset emails",
      "Multiple failed login attempts",
      "Alerts from password managers or breach notification services",
      "Unusual login location/device alerts"
    ],
    tools: ["Bitwarden", "1Password", "Have I Been Pwned", "Password managers' built-in auditors"],
    recoverySteps: [
      "Change the compromised password immediately from a secure device.",
      "Revoke sessions and API tokens where supported.",
      "Enable 2FA and check account activity logs.",
      "Notify service provider if suspicious activity persists."
    ],
    realLifeExample: `Attackers reuse leaked passwords to break into other services; unique passphrases prevent attackers from pivoting after a single breach.`,
    quickTip: `Use a password manager and enable breach alerts to automatically find exposed credentials.`,
    reference: ["https://www.cybrary.it/skill-certification-course/password-security-best-practices/"]
  },
  {
    title: "Enable Two-Factor Authentication (2FA)",
    text: "Add a second verification factor to accounts.",
    description: `2FA greatly reduces the chance an attacker can access an account with only a password. Multiple modes exist — authenticator apps, hardware keys, SMS (less secure). Prefer app-based or hardware 2FA.`,
    importance: [
      "Blocks many automated and opportunistic attacks.",
      "Protects accounts even if passwords are compromised.",
      "Adds an extra layer of identity verification for critical accounts.",
      "Reduces account takeover from phishing attempts."
    ],
    proTips: [
      "Use an authenticator app (Authy, Google Authenticator, FreeOTP) or hardware key (YubiKey).",
      "Keep backup codes in a secure place and restrict SMS where possible.",
      "Register multiple 2FA methods if allowed (backup phone, hardware key).",
      "Avoid SMS-based 2FA for high-value accounts due to SIM-swapping risks."
    ],
    bestPractices: [
      "Enable 2FA for email, password managers, cloud storage, financial accounts first.",
      "Store backup codes offline and rotate keys when changing devices.",
      "Test recovery methods in advance.",
      "Educate team/family members about 2FA setup."
    ],
    howTo: [
      "Open account security settings -> Two-factor authentication -> Choose app or hardware.",
      "Scan QR code with authenticator app and save recovery codes.",
      "Add a backup method (secondary phone or key) if available.",
      "Test 2FA login after setup to confirm it's working."
    ],
    signs: [
      "Unexpected login approvals or prompts",
      "Login attempts asking for codes you didn't request",
      "Alerts of failed login attempts from new devices"
    ],
    tools: ["Authy", "Google Authenticator", "YubiKey", "Microsoft Authenticator"],
    recoverySteps: [
      "Use saved backup codes to regain access.",
      "Contact provider support with proof of identity if you lose 2FA devices.",
      "Revoke 2FA on compromised accounts and reset."
    ],
    realLifeExample: `Users with 2FA stopped attackers who obtained passwords via phishing; hardware keys prevented account takeover entirely.`,
    quickTip: `Always keep backup codes offline and consider multiple 2FA methods for critical accounts.`,
    reference: ["https://www.cisa.gov/two-factor-authentication"]
  },
  {
    title: "Avoid Suspicious Links",
    text: "Don't click links or download attachments from unknown sources.",
    description: `Phishing remains the most effective initial access vector. Attackers craft realistic messages to trick users into clicking malicious links or submitting credentials.`,
    importance: [
      "Prevents credential theft and malware installation.",
      "Stops lateral movement from phishing-originated access.",
      "Maintains data integrity and reduces downtime from malware.",
      "Protects sensitive business or personal information."
    ],
    proTips: [
      "Hover to inspect link destinations before clicking; check domain accuracy.",
      "Normalize unusual messages by contacting the sender through a trusted channel.",
      "Use browser link checkers or URL scanning services when in doubt.",
      "Educate team/family about common phishing patterns."
    ],
    bestPractices: [
      "Disable automatic downloads and preview features for email attachments.",
      "Train teams with regular phishing simulations and refreshers.",
      "Block known malicious domains with DNS filtering or web proxies.",
      "Report suspicious messages to IT/security teams."
    ],
    howTo: [
      "If you receive an unexpected link, open the site manually via typing the domain or using a bookmark.",
      "Verify attachments with the sender via a separate channel.",
      "Scan suspicious URLs or files using VirusTotal or similar.",
      "Keep browser extensions updated for threat detection."
    ],
    signs: [
      "Misspelled domain names or unexpected TLDs",
      "Urgent language requesting credentials or immediate action",
      "Requests for sensitive info without context",
      "Unexpected popups or redirects after clicking links"
    ],
    tools: ["VirusTotal", "Google Safe Browsing", "Cisco Umbrella", "Egress email protection"],
    recoverySteps: [
      "If credentials were entered, change passwords immediately and enable 2FA.",
      "Scan the device with updated endpoint protection and remove artifacts.",
      "Check account activity for unauthorized actions.",
      "Report the phishing attempt to the organization or service provider."
    ],
    realLifeExample: `Phishing emails impersonating banks trick users into entering credentials; careful link inspection prevented breaches.`,
    quickTip: `Always hover over links and verify senders before clicking or downloading attachments.`,
    reference: ["https://www.phishing.org/what-is-phishing"]
  },
  {
    title: "Keep Devices Updated",
    text: "Install OS and app updates promptly.",
    description: `Software updates include security patches for vulnerabilities attackers exploit. Staying current reduces the attack surface and improves stability.`,
    importance: [
      "Closes known vulnerabilities attackers exploit.",
      "Improves compatibility and security features.",
      "Reduces risk of malware infections and exploits.",
      "Maintains compliance with security standards."
    ],
    proTips: [
      "Enable automatic updates for OS and critical apps.",
      "Delay non-critical feature updates briefly for stability in enterprise environments.",
      "Subscribe to vendor security advisories for critical systems.",
      "Check update logs to ensure patches installed successfully."
    ],
    bestPractices: [
      "Apply patches within a defined SLA (30 days normal, 48 hours critical).",
      "Maintain an inventory of devices and patch status.",
      "Test patches in staging environments where possible.",
      "Document patching for auditing and compliance."
    ],
    howTo: [
      "Enable automatic updates on Windows/Mac/Linux and mobile OSes.",
      "Update browsers and browser extensions frequently.",
      "Reboot devices to complete updates.",
      "Check vendor advisories and install hotfixes promptly."
    ],
    signs: [
      "Unexpected popups or instability after long periods without updates",
      "End-of-support or unpatched vulnerability notifications"
    ],
    tools: ["WSUS", "SCCM", "ManageEngine Patch Manager", "Ivanti", "Vendor update channels"],
    recoverySteps: [
      "If a vulnerability is exploited, isolate the device and perform a clean rebuild.",
      "Restore data from verified backups.",
      "Audit device compliance and patch history."
    ],
    realLifeExample: `A zero-day vulnerability exploited unpatched Windows systems; timely updates prevented large-scale compromise.`,
    quickTip: `Enable auto-updates and schedule regular patch audits.`,
    reference: ["https://us.norton.com/internetsecurity-how-to-keep-your-computer-up-to-date.html"]
  },
  {
    title: "Install and Maintain Antivirus / EDR",
    text: "Use reputable endpoint protection and keep it updated.",
    description: `Antivirus and Endpoint Detection & Response (EDR) detect malware, suspicious behavior, and intrusion attempts. Heuristic and behavioral analysis helps catch new threats.`,
    importance: [
      "Detects known and emerging threats.",
      "Provides remediation tools and quarantine capabilities.",
      "Reduces risk of ransomware and data theft.",
      "Helps comply with organizational security policies."
    ],
    proTips: [
      "Keep definitions and engines updated automatically.",
      "Prefer solutions with cloud lookups and behavioral detection.",
      "Combine EDR with regular backups for resilience.",
      "Avoid running multiple real-time antivirus engines simultaneously."
    ],
    bestPractices: [
      "Run full-system scans regularly and quick scans for high-risk hosts.",
      "Monitor alerts and investigate false positives promptly.",
      "Ensure agents are centrally managed in enterprise deployments.",
      "Use logs and dashboards to track threats over time."
    ],
    howTo: [
      "Install vendor-recommended agent and enable real-time protection.",
      "Configure scheduled scans and reporting to a central console.",
      "Review alerts and take remediation actions as recommended.",
      "Update engines and definitions frequently."
    ],
    signs: [
      "Unusual system behavior or crashes",
      "Unexpected high network traffic",
      "Frequent alerts from antivirus/EDR"
    ],
    tools: ["Windows Defender", "Malwarebytes", "CrowdStrike", "SentinelOne", "Sophos"],
    recoverySteps: [
      "Isolate infected host and follow vendor remediation steps.",
      "Restore clean images from backups if removal fails.",
      "Reset credentials and 2FA if compromise suspected."
    ],
    realLifeExample: `EDR detected ransomware attempting to encrypt files and isolated it before network spread.`,
    quickTip: `Always keep your antivirus/EDR updated and monitor alerts daily.`,
    reference: ["https://www.cisecurity.org/white-papers/endpoint-security-best-practices/"]
  },
  {
    title: "Never Share One-Time Passwords (OTPs)",
    text: "Keep OTPs and verification codes private.",
    description: `OTPs are a second line of defense for account verification. Attackers often request OTPs to bypass authentication — never share them.`,
    importance: [
      "Sharing OTPs effectively hands over your second factor to attackers.",
      "Prevents account takeover even if password is compromised."
    ],
    proTips: [
      "Treat OTPs like passwords; never disclose over phone/email/DM.",
      "Verify requests via official channels before sharing.",
      "Use hardware keys or app-based 2FA to avoid OTP interception."
    ],
    bestPractices: [
      "Enable secure 2FA methods instead of relying solely on OTPs.",
      "Educate family/team members about OTP security.",
      "Regularly review account sessions and revoke unauthorized access."
    ],
    howTo: [
      "Do not respond to unsolicited OTP requests; report them.",
      "Use hardware keys or authenticator apps when possible.",
      "Confirm any OTP request directly with the service provider."
    ],
    signs: [
      "Unexpected calls/messages asking for codes you didn't request",
      "Account alerts for login attempts you did not initiate"
    ],
    tools: ["Authenticator apps (Authy, Google Authenticator)", "Hardware keys (YubiKey, Titan)"],
    recoverySteps: [
      "If shared, change account password and revoke sessions immediately.",
      "Enable more secure 2FA (authenticator app or hardware key)."
    ],
    realLifeExample: `Attackers posing as support staff asked for OTP; user refused, preventing account takeover.`,
    quickTip: `Never share OTPs. Treat them like your password.`,
    reference: ["https://www.microsoft.com/en-us/safety/online-privacy/otp-security"]
  },
  {
    title: "Verify Website URLs and Certificates",
    text: "Always confirm website authenticity before entering sensitive data.",
    description: `Attackers clone legitimate sites with subtle differences in domain names. Confirm URL, HTTPS certificate, and branding before submitting credentials or payments.`,
    importance: [
      "Prevents credential theft and phishing.",
      "Reduces risk of entering data on fraudulent sites.",
      "Maintains financial and personal data integrity.",
      "Helps avoid malware installation via fake sites."
    ],
    proTips: [
      "Type critical websites directly or use bookmarks.",
      "Inspect TLS certificate details for issuer/organization.",
      "Look for subtle typos or extra subdomains.",
      "Use browser extensions that warn about suspicious domains."
    ],
    bestPractices: [
      "Check for HTTPS and padlock, but do not rely on them alone.",
      "Verify domain spelling carefully.",
      "Report phishing sites to authorities or IT teams.",
      "Educate team/family about common URL tricks."
    ],
    howTo: [
      "Hover over links to preview destination.",
      "Use browser dev/security pane to check certificate issuer.",
      "Manually type domain if unsure about link.",
      "Scan unknown sites with VirusTotal or PhishTank."
    ],
    signs: [
      "Unexpected TLDs or subdomains",
      "Requests for sensitive info without context",
      "Mismatched branding or layout",
      "Unexpected redirects or popups"
    ],
    tools: ["Browser dev tools", "VirusTotal", "PhishTank", "HTTPS certificate inspectors"],
    recoverySteps: [
      "If credentials entered, change passwords and enable 2FA.",
      "Monitor accounts for unauthorized activity.",
      "Notify service providers of fraudulent site."
    ],
    realLifeExample: `A cloned banking site with a different TLD tricked users; careful URL inspection prevented login.`,
    quickTip: `Always type URLs manually for sensitive accounts.`,
    reference: ["https://www.cisa.gov/uscert/ncas/tips/ST04-006"]
  },
  {
    title: "Avoid or Harden Usage of Public Wi‑Fi",
    text: "Don't use unsecured public networks for sensitive tasks.",
    description: `Public Wi‑Fi can expose traffic to interception (man-in-the-middle attacks). Use a trusted VPN and avoid sensitive operations on untrusted networks.`,
    importance: [
      "Prevents interception of unencrypted traffic.",
      "Reduces the chance credentials or session cookies are stolen.",
      "Protects sensitive business/personal communications.",
      "Prevents malware injection through compromised networks."
    ],
    proTips: [
      "Use a personal VPN when on public networks (WireGuard/OpenVPN providers you trust).",
      "Disable sharing and Bluetooth while on public networks.",
      "Forget networks after use.",
      "Avoid auto-join on unknown networks."
    ],
    bestPractices: [
      "Avoid online banking, confidential work, password changes on public Wi‑Fi without VPN.",
      "Prefer cellular data for sensitive tasks.",
      "Use HTTPS websites for any public network activity.",
      "Enable firewall on devices."
    ],
    howTo: [
      "Install and configure VPN client; enable before connecting.",
      "Turn off auto-join for open networks.",
      "Verify VPN connection is active before accessing sensitive services."
    ],
    signs: [
      "Unexpected network prompts",
      "Network requests for login to public portals",
      "Slow or inconsistent connectivity with redirection"
    ],
    tools: ["ProtonVPN", "Tailscale", "NordVPN", "WireGuard"],
    recoverySteps: [
      "Change credentials from trusted network after public Wi‑Fi use if suspicious.",
      "Revoke sessions and monitor accounts."
    ],
    realLifeExample: `An attacker used rogue public Wi-Fi to intercept traffic; user avoided logging in, preventing credential theft.`,
    quickTip: `Always use VPN on public networks, even for browsing.`,
    reference: ["https://www.kaspersky.com/resource-center/definitions/public-wifi"]
  },
  {
    title: "Backup Your Data Regularly (3-2-1 Rule)",
    text: "Use multiple, tested backups to protect critical data.",
    description: `Backups protect against accidental deletion, device failure, and ransomware. The 3-2-1 rule: 3 copies, 2 media types, 1 offsite/cloud.`,
    importance: [
      "Enables recovery after data loss or ransomware without paying ransom.",
      "Preserves historical versions of critical files.",
      "Reduces downtime and operational impact.",
      "Ensures compliance with retention policies."
    ],
    proTips: [
      "Automate backups and verify restore procedures periodically.",
      "Encrypt backups and keep credentials secure.",
      "Maintain separate backups for critical and non-critical systems.",
      "Monitor backup logs for errors or failures."
    ],
    bestPractices: [
      "Keep at least one offline or air-gapped backup for critical systems.",
      "Test restore quarterly to verify integrity.",
      "Rotate backup media periodically.",
      "Document backup process and schedule."
    ],
    howTo: [
      "Configure cloud backups for important folders and system images.",
      "Use versioned backups to retain historical file states.",
      "Regularly test restore process to ensure reliability."
    ],
    signs: [
      "Backup failures or errors",
      "Missing files or corrupted backups",
      "Ransomware attack or accidental deletion events"
    ],
    tools: ["Backblaze", "rclone", "Duplicati", "Acronis", "rsync"],
    recoverySteps: [
      "Isolate infected machines and restore from clean backup.",
      "Audit backup integrity and rotate credentials post-incident.",
      "Check systems for malware before reconnecting restored data."
    ],
    realLifeExample: `A ransomware attack encrypted local files; offline backups allowed full restoration without paying ransom.`,
    quickTip: `Follow the 3-2-1 backup rule and test restores periodically.`,
    reference: ["https://www.nist.gov/blogs/taking-measure/backups-321-rule-data-protection"]
  }


];