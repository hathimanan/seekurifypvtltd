import nodemailer from "nodemailer";
import { google } from "googleapis";

async function createTransporter() {
  // read env at call time (avoid using module-top cached values)
  const GMAIL_CLIENT_ID = (process.env.GMAIL_CLIENT_ID || "").trim();
  const GMAIL_CLIENT_SECRET = (process.env.GMAIL_CLIENT_SECRET || "").trim();
  const GMAIL_REFRESH_TOKEN = (process.env.GMAIL_REFRESH_TOKEN || "").trim();
  const GMAIL_USER = (process.env.GMAIL_USER || "").trim();

  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN || !GMAIL_USER) {
    throw new Error("No valid Gmail OAuth2 credentials found (GMAIL_CLIENT_ID/GMAIL_CLIENT_SECRET/GMAIL_REFRESH_TOKEN/GMAIL_USER required)");
  }

  const oAuth2Client = new google.auth.OAuth2(
    GMAIL_CLIENT_ID,
    GMAIL_CLIENT_SECRET,
    "https://developers.google.com/oauthplayground"
  );

  oAuth2Client.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN });

  // getAccessToken may return a string or an object { token: string }
  const accessTokenResult = await oAuth2Client.getAccessToken();
  const accessToken = accessTokenResult?.token ?? accessTokenResult;

  if (!accessToken) {
    throw new Error("Failed to obtain Gmail access token via refresh token");
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      type: "OAuth2",
      user: GMAIL_USER,
      clientId: GMAIL_CLIENT_ID,
      clientSecret: GMAIL_CLIENT_SECRET,
      refreshToken: GMAIL_REFRESH_TOKEN,
      accessToken,
    },
  });
}

export async function sendWatchAlertsEmail(toEmail, alerts) {
  const transporter = await createTransporter();

  const severityEmoji = { critical: '🔴', high: '🟠', medium: '🟡', low: '🔵', improvement: '🟢' };

  const alertRows = alerts.map(a => {
    const emoji = severityEmoji[a.severity] ?? '⚪';
    const delta = a.scoreDelta !== 0
      ? `<span style="color:${a.scoreDelta < 0 ? '#dc2626' : '#16a34a'}">${a.scoreDelta > 0 ? '+' : ''}${a.scoreDelta} pts</span>`
      : '';
    return `
      <tr style="border-bottom:1px solid #e5e7eb">
        <td style="padding:10px 8px">${emoji} <strong>${a.severity.toUpperCase()}</strong></td>
        <td style="padding:10px 8px;font-family:monospace;font-size:13px">${a.hostname}</td>
        <td style="padding:10px 8px">${a.newScore}/100 ${delta}</td>
        <td style="padding:10px 8px;color:#374151">${a.summary}</td>
      </tr>`;
  }).join('');

  const mailOptions = {
    from: `Seekurify <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: `Seekurify Watch Agent — ${alerts.length} security alert${alerts.length > 1 ? 's' : ''} detected`,
    html: `
      <div style="font-family:sans-serif;max-width:700px;margin:0 auto;padding:24px">
        <h2 style="color:#4f46e5;margin-bottom:4px">🔍 Seekurify Watch Agent</h2>
        <p style="color:#6b7280;margin-top:0">Security changes were detected during your latest scan.</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:16px">
          <thead>
            <tr style="background:#f3f4f6;text-align:left">
              <th style="padding:10px 8px">Severity</th>
              <th style="padding:10px 8px">Host</th>
              <th style="padding:10px 8px">Score</th>
              <th style="padding:10px 8px">Summary</th>
            </tr>
          </thead>
          <tbody>${alertRows}</tbody>
        </table>
        <p style="margin-top:24px;font-size:13px;color:#9ca3af">
          Log in to Seekurify to view full details and mark alerts as read.
        </p>
      </div>`,
  };

  return transporter.sendMail(mailOptions);
}

// ---------------------------------------------------------------------------
// Breach alert email — fired when new compromised credentials are detected
// ---------------------------------------------------------------------------
export async function sendBreachAlertEmail(toEmail, { credentials, appUrl }) {
  const transporter = await createTransporter();
  const baseUrl = appUrl || process.env.APP_URL || 'https://seekurify.com';

  const credentialRows = credentials.map(c => `
    <tr style="border-bottom:1px solid #fee2e2">
      <td style="padding:10px 12px;font-weight:600;color:#111827">${c.website}</td>
      <td style="padding:10px 12px;color:#6b7280;font-size:13px">${c.username}</td>
      <td style="padding:10px 12px">
        <span style="background:#fee2e2;color:#dc2626;padding:2px 8px;border-radius:999px;font-size:12px;font-weight:700">
          Found in ${(c.breachCount || 0).toLocaleString()} breach${(c.breachCount || 0) !== 1 ? 'es' : ''}
        </span>
      </td>
    </tr>`).join('');

  // Pick the single most important action — highest breach count wins
  const top = [...credentials].sort((a, b) => (b.breachCount || 0) - (a.breachCount || 0))[0];
  const topAction = `Change your <strong>${top.website}</strong> password immediately — it has appeared in ${(top.breachCount || 0).toLocaleString()} known data breaches and is the highest-risk credential in your vault.`;

  const mailOptions = {
    from: `Seekurify 🔐 <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: `⚠️ Seekurify Security Alert — ${credentials.length} compromised credential${credentials.length !== 1 ? 's' : ''} detected`,
    html: `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:620px;margin:0 auto;background:#f3f4f6;padding:24px">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#dc2626,#b91c1c);padding:28px 32px;border-radius:12px 12px 0 0;text-align:center">
    <div style="font-size:32px;margin-bottom:8px">🔐</div>
    <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700">Security Alert</h1>
    <p style="color:#fca5a5;margin:4px 0 0;font-size:14px">Seekurify Credential Intelligence</p>
  </div>

  <!-- Body -->
  <div style="background:#ffffff;padding:32px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb">

    <!-- Risk badge -->
    <div style="text-align:center;margin-bottom:24px">
      <span style="display:inline-block;background:#fee2e2;color:#dc2626;padding:6px 16px;border-radius:999px;font-size:13px;font-weight:700;letter-spacing:.5px">
        ⚠️&nbsp; BREACH DETECTED
      </span>
    </div>

    <p style="color:#374151;font-size:15px;margin:0 0 8px">Hi there,</p>
    <p style="color:#374151;font-size:15px;margin:0 0 24px">
      Your latest Seekurify breach scan found
      <strong style="color:#dc2626">${credentials.length} compromised password${credentials.length !== 1 ? 's' : ''}</strong>
      in your vault. These passwords have appeared in known data breach databases and should be changed immediately.
    </p>

    <!-- Credential table -->
    <table style="width:100%;border-collapse:collapse;font-size:14px;border-radius:8px;overflow:hidden;border:1px solid #fee2e2">
      <thead>
        <tr style="background:#fef2f2">
          <th style="padding:10px 12px;text-align:left;color:#991b1b;font-size:12px;text-transform:uppercase;letter-spacing:.5px">Site</th>
          <th style="padding:10px 12px;text-align:left;color:#991b1b;font-size:12px;text-transform:uppercase;letter-spacing:.5px">Username</th>
          <th style="padding:10px 12px;text-align:left;color:#991b1b;font-size:12px;text-transform:uppercase;letter-spacing:.5px">Exposure</th>
        </tr>
      </thead>
      <tbody>${credentialRows}</tbody>
    </table>

    <!-- Most important action -->
    <div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:14px 16px;margin:24px 0;border-radius:0 6px 6px 0">
      <p style="margin:0;font-size:14px;color:#374151">
        <strong style="color:#92400e">Most important action:</strong><br/>
        <span style="margin-top:4px;display:block">${topAction}</span>
      </p>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin-top:24px">
      <a href="${baseUrl}/dashboard"
         style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:600;letter-spacing:.3px">
        Fix Now in Seekurify &nbsp;→
      </a>
    </div>

  </div>

  <!-- Footer -->
  <div style="background:#f9fafb;padding:16px 32px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb;border-top:none;text-align:center">
    <p style="margin:0;font-size:12px;color:#9ca3af">
      You're receiving this because your Seekurify vault was scanned for known data breaches.<br/>
      Seekurify never stores your plaintext passwords — breach checks use secure k-anonymity hashing.
    </p>
  </div>

</div>`,
  };

  return transporter.sendMail(mailOptions);
}

// ---------------------------------------------------------------------------
// High-risk alert email — fired when credentials score critical after scoring
// ---------------------------------------------------------------------------
export async function sendHighRiskAlertEmail(toEmail, { credentials, appUrl }) {
  const transporter = await createTransporter();
  const baseUrl = appUrl || process.env.APP_URL || 'https://seekurify.com';

  const LEVEL_COLOR = {
    critical: { bg: '#fee2e2', text: '#dc2626', label: 'CRITICAL' },
    high:     { bg: '#ffedd5', text: '#ea580c', label: 'HIGH' },
  };

  const credentialRows = credentials.map(c => {
    const style = LEVEL_COLOR[c.level] ?? LEVEL_COLOR.high;
    return `
    <tr style="border-bottom:1px solid #e5e7eb">
      <td style="padding:10px 12px;font-weight:600;color:#111827">${c.website}</td>
      <td style="padding:10px 12px;color:#6b7280;font-size:13px">${c.username}</td>
      <td style="padding:10px 12px;text-align:center">
        <span style="display:inline-block;background:${style.bg};color:${style.text};padding:2px 8px;border-radius:999px;font-size:12px;font-weight:700">
          ${c.score}/100
        </span>
      </td>
      <td style="padding:10px 12px">
        <span style="background:${style.bg};color:${style.text};padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700">
          ${style.label}
        </span>
      </td>
    </tr>`;
  }).join('');

  const top = credentials[0];

  const mailOptions = {
    from: `Seekurify 🔐 <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: `🔴 Seekurify Risk Alert — ${credentials.length} credential${credentials.length !== 1 ? 's' : ''} need${credentials.length === 1 ? 's' : ''} immediate attention`,
    html: `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:620px;margin:0 auto;background:#f3f4f6;padding:24px">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:28px 32px;border-radius:12px 12px 0 0;text-align:center">
    <div style="font-size:32px;margin-bottom:8px">🛡️</div>
    <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700">Risk Score Alert</h1>
    <p style="color:#c4b5fd;margin:4px 0 0;font-size:14px">Seekurify Credential Intelligence</p>
  </div>

  <!-- Body -->
  <div style="background:#ffffff;padding:32px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb">

    <p style="color:#374151;font-size:15px;margin:0 0 24px">
      Your risk scan found <strong style="color:#4f46e5">${credentials.length} credential${credentials.length !== 1 ? 's' : ''}</strong>
      with a <strong>critical or high risk score</strong> that require your attention.
    </p>

    <!-- Credential table -->
    <table style="width:100%;border-collapse:collapse;font-size:14px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
      <thead>
        <tr style="background:#f9fafb">
          <th style="padding:10px 12px;text-align:left;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:.5px">Site</th>
          <th style="padding:10px 12px;text-align:left;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:.5px">Username</th>
          <th style="padding:10px 12px;text-align:center;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:.5px">Score</th>
          <th style="padding:10px 12px;text-align:left;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:.5px">Level</th>
        </tr>
      </thead>
      <tbody>${credentialRows}</tbody>
    </table>

    ${top?.summary ? `
    <div style="background:#f5f3ff;border-left:4px solid #7c3aed;padding:14px 16px;margin:24px 0;border-radius:0 6px 6px 0">
      <p style="margin:0;font-size:14px;color:#374151">
        <strong style="color:#5b21b6">Top priority — ${top.website}:</strong><br/>
        <span style="margin-top:4px;display:block">${top.summary}</span>
      </p>
    </div>` : ''}

    <!-- CTA -->
    <div style="text-align:center;margin-top:24px">
      <a href="${baseUrl}/dashboard"
         style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:600;letter-spacing:.3px">
        View &amp; Fix in Seekurify &nbsp;→
      </a>
    </div>
  </div>

  <!-- Footer -->
  <div style="background:#f9fafb;padding:16px 32px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb;border-top:none;text-align:center">
    <p style="margin:0;font-size:12px;color:#9ca3af">
      Risk scores factor in breach status, account type, password reuse, age, and strength.
    </p>
  </div>

</div>`,
  };

  return transporter.sendMail(mailOptions);
}

export async function sendPlaybookAlertEmail(toEmail, { subject, body }) {
  const transporter = await createTransporter();
  return transporter.sendMail({
    from: `Seekurify <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject,
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
      <div style="background:#4f46e5;padding:20px 24px">
        <h2 style="color:#fff;margin:0;font-size:18px">Seekurify Security Playbook Alert</h2>
      </div>
      <div style="padding:24px;color:#374151;font-size:14px;line-height:1.6">
        ${body.replace(/\n/g, '<br/>')}
      </div>
      <div style="padding:16px 24px;background:#f9fafb;border-top:1px solid #e5e7eb">
        <p style="margin:0;font-size:12px;color:#9ca3af">Automated alert from Seekurify SOAR</p>
      </div>
    </div>`,
  });
}

export default async function sendResetEmail(toEmail, resetCode) {
  const transporter = await createTransporter();

  const mailOptions = {
    from: `Seekurify <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: "Seekurify — Password reset code",
    html: `
      <p>Your password reset code is <strong>${resetCode}</strong>.</p>
      <p>This code will expire in 10 minutes.</p>
    `,
  };

  return transporter.sendMail(mailOptions);
}
