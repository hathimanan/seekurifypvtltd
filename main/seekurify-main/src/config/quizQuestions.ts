export interface QuizQuestion {
  id: number;
  category: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export const allQuizQuestions: QuizQuestion[] = [
  // ── Phishing (3) ──────────────────────────────────────────────────────────
  {
    id: 1,
    category: "Phishing",
    question:
      "You receive an email from 'sbi-secure-login.in' asking you to click a link to verify your KYC or your account will be blocked. What should you do?",
    options: [
      "Click the link immediately to avoid losing access",
      "Forward it to friends to warn them",
      "Ignore it and report it to SBI's official phishing email (report.phishing@sbi.co.in)",
      "Reply asking them to give you more time",
    ],
    correctIndex: 2,
    explanation:
      "Legitimate banks never ask for KYC via unsolicited email links. The domain 'sbi-secure-login.in' is NOT sbi.co.in — that extra text before the real domain is a classic phishing trick. Always report such emails using the official bank's phishing contact.",
  },
  {
    id: 2,
    category: "Phishing",
    question:
      "An email congratulates you for winning ₹50,000 in an Amazon Diwali lucky draw and asks you to enter your UPI PIN to claim the prize. What is this?",
    options: [
      "A genuine Amazon promotion",
      "A UPI prize phishing scam — your PIN is never needed to receive money",
      "An Aadhaar-linked bonus",
      "A valid government cashback scheme",
    ],
    correctIndex: 1,
    explanation:
      "You NEVER need to enter your UPI PIN to receive money — PINs are only used to send money. Asking for your PIN to 'receive' a prize is a hallmark phishing/vishing scam. Amazon does not distribute prizes this way.",
  },
  {
    id: 3,
    category: "Phishing",
    question:
      "You get an email appearing to be from HDFC Bank, but the sender domain is 'hdfc-support.ru'. Why is this suspicious?",
    options: [
      "It is fine — '.ru' means 'reliable URL'",
      "HDFC uses .ru domains for international customers",
      "'.ru' is Russia's country code — HDFC only uses hdfcbank.com; any other domain is likely a spoof",
      "It is suspicious only if the email asks for OTP",
    ],
    correctIndex: 2,
    explanation:
      "'.ru' is the top-level domain for Russia. HDFC Bank's official domain is hdfcbank.com. Phishing emails often use lookalike domains with different extensions or extra words. Always hover over the sender address before clicking anything.",
  },

  // ── Smishing (2) ──────────────────────────────────────────────────────────
  {
    id: 4,
    category: "Smishing",
    question:
      "You receive an SMS: 'Dear user, your Aadhaar KYC is pending. TRAI will block your SIM in 24 hours. Update now: bit.ly/aadhaar-kyc'. What should you do?",
    options: [
      "Click the link before your SIM gets blocked",
      "Call TRAI's helpline mentioned in the SMS",
      "Ignore and delete — TRAI never threatens SIM blocks via SMS with short links",
      "Share with family members so they can update their Aadhaar too",
    ],
    correctIndex: 2,
    explanation:
      "TRAI (Telecom Regulatory Authority of India) does not send SIM-block threats via SMS. Shortened URLs like bit.ly in official government messages are a red flag. This is a classic smishing (SMS phishing) attack targeting Aadhaar anxiety.",
  },
  {
    id: 5,
    category: "Smishing",
    question:
      "An SMS from 'INPOST-HELPDESK' says your India Post parcel is stuck at customs and you must pay ₹29 via a link to release it. You are expecting a package. What do you do?",
    options: [
      "Pay immediately since ₹29 is a small amount",
      "Click the link to check the parcel status",
      "Visit the official India Post website (indiapost.gov.in) directly to track your parcel",
      "Reply 'STOP' to unsubscribe",
    ],
    correctIndex: 2,
    explanation:
      "Scammers exploit parcel anxiety with tiny fees that seem harmless. The link captures your card details, not just ₹29. Always go directly to the official carrier website. India Post's official domain is indiapost.gov.in.",
  },

  // ── Vishing (2) ──────────────────────────────────────────────────────────
  {
    id: 6,
    category: "Vishing",
    question:
      "A caller claims to be from the 'RBI Cyber Fraud Wing' and says your account is flagged. They ask you to share a one-time password (OTP) they will send to 'verify your identity'. What should you do?",
    options: [
      "Share the OTP since they are from RBI",
      "Ask for their employee ID and then share the OTP",
      "Hang up immediately — RBI never calls asking for OTPs",
      "Share just the first three digits to be safe",
    ],
    correctIndex: 2,
    explanation:
      "The Reserve Bank of India never calls customers asking for OTPs, passwords, or account numbers. An OTP is a one-time password that authorises a transaction — sharing it with anyone, even someone claiming to be a government official, is handing over access to your account.",
  },
  {
    id: 7,
    category: "Vishing",
    question:
      "Your phone rings. The caller says they are from your bank's fraud team and an unauthorised transaction just occurred on your account. They say they are 'reversing it' and will send you an OTP to confirm. What is happening?",
    options: [
      "The bank is genuinely helping you reverse fraud",
      "The caller is about to USE the OTP they send — to complete a transaction, not reverse one",
      "This is a standard fraud-alert call that all banks make",
      "You should share the OTP only if the caller gives the correct last 4 digits of your card",
    ],
    correctIndex: 1,
    explanation:
      "This is a social engineering trick: the attacker is actually initiating a transaction. When they say 'we'll send you an OTP to reverse the fraud', they are triggering a real payment and need your OTP to complete it. Banks never need your OTP to reverse transactions.",
  },

  // ── Social Engineering (2) ──────────────────────────────────────────────
  {
    id: 8,
    category: "Social Engineering",
    question:
      "A colleague messages you on WhatsApp: 'Hey, it's Raju from IT. I'm locked out of the admin panel urgently — can you share your login credentials just for 10 minutes?' What do you do?",
    options: [
      "Share credentials since it's a colleague and it's urgent",
      "Share only the username, not the password",
      "Decline and verify the request via official IT helpdesk channels — credentials are never shared",
      "Change your password after sharing so it's safe",
    ],
    correctIndex: 2,
    explanation:
      "Sharing credentials — even temporarily — violates security policy and may expose your account permanently. Attackers impersonate IT staff and create urgency to bypass judgment. Always verify through your company's official IT support channel before acting.",
  },
  {
    id: 9,
    category: "Social Engineering",
    question:
      "You find a USB drive labelled 'Payroll Q3 2025' in your office parking lot. What should you do?",
    options: [
      "Plug it in to check if it belongs to a colleague",
      "Use a personal laptop so your work system isn't at risk",
      "Hand it to IT security without plugging it in anywhere",
      "Check it at home using your own PC",
    ],
    correctIndex: 2,
    explanation:
      "This is called 'USB baiting' — attackers drop infected drives hoping curiosity takes over. Plugging in an unknown USB can install malware instantly, regardless of which device you use. Always hand unknown storage devices to IT security.",
  },

  // ── Digital Arrest (2) ──────────────────────────────────────────────────
  {
    id: 10,
    category: "Digital Arrest",
    question:
      "A uniformed 'CBI officer' appears on a video call and tells you that your Aadhaar is linked to a money laundering case. They say you are 'digitally arrested' and must stay on the call or face real arrest. What is this?",
    options: [
      "A real CBI operation — cooperate to clear your name",
      "A scam — 'Digital Arrest' has no legal existence in India; this is a fraud call",
      "An Enforcement Directorate notice delivered digitally",
      "A legitimate cybercrime investigation by the Home Ministry",
    ],
    correctIndex: 1,
    explanation:
      "'Digital Arrest' is a fraud invented by scammers — it has NO legal basis in India. The CBI and police do NOT arrest people over video calls. The goal is to keep you on the call in a state of fear until you transfer money. Hang up and report to 1930 (National Cybercrime Helpline) or cybercrime.gov.in.",
  },
  {
    id: 11,
    category: "Digital Arrest",
    question:
      "A 'senior police officer' video-calls you and shows a 'warrant' for your arrest. They say you must transfer ₹5 lakh to a 'safe government account' immediately or go to jail. What is the safest action?",
    options: [
      "Transfer the money to avoid arrest",
      "Ask for 24 hours and then transfer",
      "End the call, do not transfer anything, and report to cybercrime helpline 1930",
      "Cooperate by sharing your bank details for verification",
    ],
    correctIndex: 2,
    explanation:
      "Legitimate law enforcement NEVER demands money transfers over video calls. 'Safe account' transfers are the final step of a Digital Arrest scam — once money is transferred it is nearly impossible to recover. Call 1930 (India's Cyber Fraud Helpline) or file at cybercrime.gov.in immediately.",
  },

  // ── Ransomware (3) ──────────────────────────────────────────────────────
  {
    id: 12,
    category: "Ransomware",
    question:
      "Your computer displays a message: 'All your files have been encrypted. Pay ₹2,00,000 in Bitcoin within 48 hours or lose everything.' What should be your FIRST action?",
    options: [
      "Pay the ransom immediately before the deadline",
      "Restart the computer to remove the ransomware",
      "Disconnect the infected computer from the network immediately",
      "Email the attacker to negotiate a lower price",
    ],
    correctIndex: 2,
    explanation:
      "The immediate priority is containment — disconnect from the network (WiFi + ethernet) to stop the ransomware from spreading to other devices. Do not pay (payment does not guarantee file recovery and funds more attacks). Then contact your IT team or a cybersecurity incident responder.",
  },
  {
    id: 13,
    category: "Ransomware",
    question:
      "A hospital's records were encrypted by ransomware and they lost patient data because their backup was 6 months old. What backup practice would have prevented the data loss?",
    options: [
      "Keeping the backup on the same server for faster recovery",
      "Backing up once a year since healthcare data changes slowly",
      "Regular backups stored offline or in a separate cloud account — following the 3-2-1 rule",
      "Storing backups on a USB drive plugged into the server permanently",
    ],
    correctIndex: 2,
    explanation:
      "The 3-2-1 rule: 3 copies of data, on 2 different media, with 1 copy offsite or offline. A backup connected to the same network can be encrypted by ransomware along with the main data. Regular offline/cloud backups are the primary defence against ransomware-driven data loss.",
  },
  {
    id: 14,
    category: "Ransomware",
    question:
      "A friend says: 'I have a good antivirus so ransomware can't touch me.' Is this accurate?",
    options: [
      "Yes — modern antivirus software blocks 100% of ransomware",
      "No — antivirus is one layer of defence but cannot guarantee protection; backups are essential",
      "Yes — if you pay for the premium version it blocks all threats",
      "Yes — as long as you also have Windows Defender enabled",
    ],
    correctIndex: 1,
    explanation:
      "Antivirus software is valuable but cannot catch every variant of ransomware, especially new or obfuscated strains. It is one layer in a defence-in-depth strategy. Offline backups remain the single most effective recovery mechanism because they are unaffected by encryption.",
  },

  // ── Safety Tips (6) ──────────────────────────────────────────────────────
  {
    id: 15,
    category: "Safety Tips",
    question:
      "An attacker steals your password from a data breach. But you have two-factor authentication (2FA) enabled. What happens?",
    options: [
      "The attacker can still log in since they have your password",
      "2FA only protects your email, not other accounts",
      "The attacker cannot log in — they also need the second factor (OTP/authenticator code) that only you have",
      "2FA is bypassed if the attacker uses a VPN",
    ],
    correctIndex: 2,
    explanation:
      "2FA means an attacker needs both your password AND a time-sensitive second factor (like an OTP or authenticator app code). A stolen password alone is not enough. Enable 2FA on every critical account — especially email, banking, and social media.",
  },
  {
    id: 16,
    category: "Safety Tips",
    question:
      "You are in a café and need to check your net banking. The café has free WiFi. What is the safest approach?",
    options: [
      "Connect to the café WiFi — it's convenient and free",
      "Use your mobile data (4G/5G) or a personal hotspot instead",
      "Connect but log out when done, which makes it safe",
      "Use the café WiFi only if it is password-protected",
    ],
    correctIndex: 1,
    explanation:
      "Public WiFi — even password-protected — can be monitored by the owner or other users. Attackers also set up fake hotspots ('Evil Twin' attacks) with convincing names like 'Café_Free_WiFi'. For banking or any sensitive activity, always use your mobile data or a personal hotspot.",
  },
  {
    id: 17,
    category: "Safety Tips",
    question:
      "You install a torch/flashlight app from the Play Store and it asks for permission to access your contacts, camera, and microphone. What should you do?",
    options: [
      "Grant all permissions — apps need them to work properly",
      "Grant permissions since it came from the official Play Store",
      "Deny unnecessary permissions — a torch only needs camera/flashlight access, never contacts or microphone",
      "Uninstall and reinstall to reset the permissions",
    ],
    correctIndex: 2,
    explanation:
      "Apps requesting permissions beyond their function are a red flag. A flashlight app has no legitimate reason to access contacts or the microphone. Granting these permissions can allow spyware to harvest your data. Always apply the principle of least privilege — only grant what is strictly needed.",
  },
  {
    id: 18,
    category: "Safety Tips",
    question:
      "A website has a padlock icon and starts with 'https://'. Does this mean the website is safe and legitimate?",
    options: [
      "Yes — HTTPS means the website is verified as trustworthy",
      "No — HTTPS only encrypts the connection; phishing sites also use HTTPS",
      "Yes — only government and bank websites can get HTTPS certificates",
      "Yes — HTTPS means the website passed a security audit",
    ],
    correctIndex: 1,
    explanation:
      "HTTPS means the data between your browser and the site is encrypted in transit — it does NOT verify whether the site owner is honest. Phishing sites routinely use HTTPS and display a padlock. Always verify the domain name itself, not just the padlock.",
  },
  {
    id: 19,
    category: "Safety Tips",
    question:
      "Why is it risky to use the same password for your UPI/banking app as your screen lock PIN?",
    options: [
      "It is perfectly fine and makes it easier to remember",
      "The screen lock PIN is visible to anyone near you who sees you unlock your phone",
      "Banking apps do not accept the same format as screen locks",
      "It only becomes risky if you use a weak PIN like 1234",
    ],
    correctIndex: 1,
    explanation:
      "Your screen lock PIN is entered frequently in public and can be observed by a nearby person ('shoulder surfing'). If someone then gets brief physical access to your phone, they can use that same PIN to authorise UPI transfers. Always use a different, stronger PIN for payment apps.",
  },
  {
    id: 20,
    category: "Safety Tips",
    question:
      "What does the '3-2-1 backup rule' mean?",
    options: [
      "Back up every 3 days, keep 2 weeks of history, and do 1 full backup per month",
      "3 copies of data, on 2 different types of media, with 1 copy stored offsite or offline",
      "3 cloud services, 2 external drives, and 1 USB stick",
      "Back up 3 times a day, 2 devices minimum, and 1 automatic schedule",
    ],
    correctIndex: 1,
    explanation:
      "The 3-2-1 rule is the gold standard of backup strategy: keep 3 total copies of your data, stored on 2 different media types (e.g., local hard drive + cloud), with 1 copy offsite or offline so ransomware or local disasters cannot destroy all copies simultaneously.",
  },
];
