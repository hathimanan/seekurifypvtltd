// src/data/tips/avoidPublicWiFi.ts

export const avoidPublicWiFi = {
  title: "Avoid Accessing Sensitive Information Over Public Wi-Fi",
  text: "Public Wi-Fi can be insecure. Protect your sensitive data by following secure practices.",
  description: `Public Wi-Fi networks — like those in coffee shops, airports, libraries, or hotels — are often unsecured, meaning that anyone on the same network could potentially monitor your activity. 
Hackers can perform man-in-the-middle (MITM) attacks to intercept your data, putting sensitive information such as bank details, login credentials, and personal files at serious risk.`,
  securePractices: [
    "Use a VPN (Virtual Private Network) to encrypt your traffic, keeping your data unreadable even if intercepted.",
    "Avoid logging into sensitive accounts such as banking, payment gateways, or confidential emails on public Wi-Fi.",
    "Disable file sharing and Bluetooth to prevent unauthorized access while connected to open networks.",
    "Use mobile data or a personal hotspot for transactions or private communications when possible.",
    "Ensure websites use HTTPS for secure, encrypted communication.",
    "Regularly update antivirus and firewall settings to defend against malware or phishing attempts on open networks.",
    "Enable two-factor authentication (2FA) for all accounts to add an extra security layer."
  ],
  additionalTip: `Pro Tip: Always "forget" the public network after use to prevent your device from auto-connecting in the future, reducing the chance of unauthorized access.`
};
