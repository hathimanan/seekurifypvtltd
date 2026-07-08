// Only disable TLS certificate verification in development
if (process.env.NODE_ENV === "development") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  console.log("⚠️ TLS certificate verification is disabled in development");
} else {
  // Production / Staging: keep TLS checks enabled
  console.log("🔒 TLS certificate verification is enabled");
}

import express from 'express';
import jwt from 'jsonwebtoken';
import bcryptjs from 'bcryptjs';
import User from '../models/User.ts';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import { google } from 'googleapis';
import validator from 'validator'; // npm install validator
import LoginEvent from '../models/LoginEvent.model.js';
import dotenv from 'dotenv';

// load environment variables immediately so subsequent imports can rely on them
const NODE_ENV = process.env.NODE_ENV || "development";
dotenv.config({
  path: NODE_ENV === "production"
    ? ".env.production"
    : NODE_ENV === "test"
    ? ".env.test"
    : ".env.development"
});

import bcrypt from 'bcrypt';
import PasswordChangeEvent from '../models/PasswordChangeEvent.model.js';
import Password from '../models/Password.js';
import { getPasswordStrength } from '../models/User.ts';

const DEFAULT_USER_TYPE = 'individual';
const DEFAULT_OWNED_FLAGS = [
  "otp_verification", "pin_verification_password_manager",
  "security_chatbot", "security_awareness", "insights",
  "learn_secure_group",
];

const USER_TYPE_TIER = { individual: 1, ai_teams: 2, security_professional: 3, enterprise: 4 };

const FEATURE_GROUP_TO_USER_TYPE = {
  identity:          'individual',
  threat:            'ai_teams',
  'ai-security':     'ai_teams',
  'web-infra':       'security_professional',
  'team-workspaces': 'security_professional',
  learn:             'individual',
  bundle:            'enterprise',
};

const PLAN_TO_USER_TYPE = {
  free:     'individual',
  pro:      'individual',
  premium:  'ai_teams',
  business: 'enterprise',
};

// Returns the highest-tier userType among what the user already has,
// the feature group they just purchased, and the plan they're on.
// UserType only ever goes up — never downgraded.
function resolveUserType(currentType, featureGroup, plan) {
  const tier = t => USER_TYPE_TIER[t] || 1;
  const current   = currentType || 'individual';
  const fromGroup = FEATURE_GROUP_TO_USER_TYPE[featureGroup] || 'individual';
  const fromPlan  = PLAN_TO_USER_TYPE[plan] || 'individual';
  return [current, fromGroup, fromPlan].reduce((best, c) => tier(c) > tier(best) ? c : best);
}
import Razorpay from "razorpay";
import Trial from "../models/Trial.js";
import requestIp from 'request-ip';
import axios from 'axios';            // ← you reference axios but never imported
import { pushAlert } from '../realtime/socketHub.js';
import { routeEvent } from '../services/triggerRouter.js';
import { UAParser } from 'ua-parser-js'; // Add this import at the top
import { analyzeLoginAnomaly } from '../services/loginAnomalyDetector.js';
import Notification from '../models/Notification.model.js';

import passwordShare from "../models/passwordShare.js";

import Log from "../models/Log.js";

import mongoose from 'mongoose';
import { GoogleGenerativeAI } from '@google/generative-ai';

// only construct the client if a key is provided; avoids spurious calls when
// the variable is unset (e.g. when you push keys into .env but comment them
// out later). If there is no key we keep genAI null and skip any Gemini logic.
const genAI = process.env.GOOGLE_AI_API_KEY
  ? new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY)
  : null;

import { 
  emailValidation, 
  passwordValidation, 
  newPasswordValidation,
  resetTokenValidation,
  usernameValidation,
  handleValidationErrors 
} from '../middleware/validation.js';


import sendResetEmail from '../emailService.js' ;
// dotenv config moved to top to ensure env vars are available earlier
const OAuth2 = google.auth.OAuth2;
const app = express();
const authRouter = express.Router();
// const userPasswords = new Map();
const secretKeyOTP = process.env.secretKeyOTP;
if (!process.env.JWT_SECRET || !secretKeyOTP) {
  throw new Error("JWT secret keys are not properly defined in environment variables.");
}

// Custom function to send email
async function sendSuspiciousLoginEmail(ip, email) {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: process.env.GMAIL_USER,
        clientId: process.env.GMAIL_CLIENT_ID,
        clientSecret: process.env.GMAIL_CLIENT_SECRET,
        refreshToken: process.env.GMAIL_REFRESH_TOKEN,
        accessToken: process.env.GMAIL_ACCESS_TOKEN
      }
    });

   const htmlContent = `
  <div style="font-family: Arial, sans-serif; color: #333;">
    <h2 style="color: #d9534f;">⚠️ Suspicious Login Detected</h2>
    <p>We noticed multiple failed login attempts to your <strong>Seekurify</strong> account from the following IP address:</p>
    <p style="background-color: #f8d7da; padding: 10px; border-radius: 5px; font-weight: bold;">${ip}</p>
    <p>If this wasn’t you, we strongly recommend you:</p>
    <ul>
      <li>Reset your password immediately</li>
      <li>
        Review your account security settings <br/>
        <span style="font-size: 14px;">
          Want to Report the incident to Government Official Cybercrime Portal? 
          <a href="https://cybercrime.gov.in/Webform/Crime_AuthoLogin.aspx" target="_blank" style="color: #007bff; text-decoration: underline;">
            Click here
          </a>
        </span>
      </li>
    </ul>
    <a href="${process.env.REACT_APP_BASE_URL}/forgot-password" target="_blank"
       style="display: inline-block; padding: 10px 20px; margin: 10px 0; background-color: #d9534f; color: #fff; text-decoration: none; border-radius: 5px;">
       Reset Password
    </a>
    <p style="font-size: 12px; color: #666;">If you did attempt to login, you can safely ignore this message.</p>
    <hr style="border: none; border-top: 1px solid #eee;" />
    <p style="font-size: 12px; color: #999;">&copy; ${new Date().getFullYear()} Seekurify. All rights reserved.</p>
  </div>
`;


    await transporter.sendMail({
      from: 'Seekurify <no-reply@Seekurify.com>',
      to: email,
      subject: 'Suspicious Login Attempts Detected',
      html: htmlContent
    });

    console.log('⚠️ Suspicious login email sent.');
  } catch (error) {
    console.error('Error sending suspicious login email:', error);
  }
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 70,
  statusCode: 429,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' },

handler: async (req, res, next, options) => {
  try {
    const clientIp = requestIp.getClientIp(req) || req.headers['x-real-ip'] || req.ip;
    const userAgent = req.get('User-Agent');
    const targetEmail = req.body?.email || process.env.ADMIN_EMAIL;

    let ipDetails = {};
    try {
      const response = await axios.get(`https://ipinfo.io/${clientIp}/json`);
      ipDetails = response.data;
    } catch (err) {
      console.error('IP Lookup failed:', err.message);
    }

    const isSuspicious =
      ipDetails.org?.toLowerCase().includes('vpn') ||
      ipDetails.org?.toLowerCase().includes('hosting') ||
      ipDetails.org?.toLowerCase().includes('cloud');

    await LoginEvent.create({
      userId: null,
      success: false,
      ipAddress: clientIp,
      userAgent,
      timestamp: new Date(),
      reason: isSuspicious ? 'Rate limit hit from suspected VPN/Proxy' : 'Rate limit hit',
      geoLocation: ipDetails.city
        ? `${ipDetails.city}, ${ipDetails.region}, ${ipDetails.country}`
        : 'Unknown',
    });

    // 🔔 Email to account email (if provided) or admin
    await sendSuspiciousLoginEmail(clientIp, targetEmail);

    // 🔔 Optional: if the email belongs to a user who is currently logged in, push a realtime alert
    if (req.body?.email) {
      const victim = await User.findOne({ email: req.body.email }).select('_id');
      if (victim?._id) {
        victim.lastSuspiciousLogin = new Date();
await victim.save();
        pushAlert(String(victim._id), "suspiciousLogin", {
          type: "rate_limited",
          ip: clientIp,
          org: ipDetails?.org || "Unknown",
          location: ipDetails?.city ? `${ipDetails.city}, ${ipDetails.region}, ${ipDetails.country}` : "Unknown",
          userAgent,
          at: new Date().toISOString(),
          message: "Multiple rapid login attempts detected (possible VPN/Proxy).",
        });
      }
    }

return res.status(options.statusCode).json({
  status: "suspicious",
  error: "Too many login attempts. Please try again later.",
  details: {
    ip: clientIp,
    org: ipDetails?.org || "Unknown",
    location: ipDetails?.city
      ? `${ipDetails.city}, ${ipDetails.region}, ${ipDetails.country}`
      : "Unknown",
    reason: isSuspicious
      ? "Rate limit hit from suspected VPN/Proxy"
      : "Rate limit hit",
  },
});
  } catch (err) {
    console.error('Login limiter handler error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
},
});


function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'Missing auth header' });

  const token = authHeader.split(' ')[1];

  const googleToken = req.params.googleToken;

  if(googleToken){
    token = googleToken;
  }
  if (!token) return res.status(401).json({ error: 'Token missing' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;

    next();
          // console.log('Decoded user in middleware:', user)

  });
}


authRouter.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;
  const ipAddress = requestIp.getClientIp(req) || req.ip;
  const userAgent = req.get('User-Agent');

  if (!email || !password) {
    return res.status(400).json({ field: 'email', error: 'Email and password are required' });
  }

  if (!validator.isEmail(email)) {
    return res.status(400).json({ field: 'email', error: 'Invalid email format' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      await LoginEvent.create({ userId: null, success: false, ipAddress, userAgent, timestamp: new Date() });
      return res.status(401).json({ field: 'email', error: 'Incorrect email or password' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      await LoginEvent.create({ userId: user._id, success: false, ipAddress, userAgent, timestamp: new Date() });

      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
      const recentFails = await LoginEvent.countDocuments({
        userId: user._id,
        success: false,
        timestamp: { $gte: fiveMinAgo },
        ipAddress,
      });

      if (recentFails >= 3 && typeof pushAlert === "function") {
        pushAlert(String(user._id), "suspiciousLogin", {
          type: "bruteforce",
          ip: ipAddress,
          userAgent,
          at: new Date().toISOString(),
          message: `Multiple failed password attempts from ${ipAddress}.`,
          count: recentFails
        });
        sendSuspiciousLoginEmail?.(ipAddress, user.email).catch(()=>{});
        routeEvent('login_anomaly', {
          type: 'bruteforce',
          ip: ipAddress,
          userAgent,
          failCount: recentFails,
        }, { userId: String(user._id) }).catch(() => {});
      }

      return res.status(401).json({ field: 'password', error: 'Incorrect email or password' });
    }

    // Successful login
    await LoginEvent.create({ userId: user._id, success: true, ipAddress, userAgent, timestamp: new Date() });

    user.lastIp = ipAddress;
    user.lastUa = userAgent;

    // Async anomaly detection — runs after response is sent, doesn't block login
    analyzeLoginAnomaly(user._id, ipAddress, userAgent).then(anomalies => {
      const anomalyMessages = {
        new_device:       a => `Sign-in from a new device: ${a.details.label}`,
        impossible_travel: a => `Impossible travel: ${a.details.distanceKm}km from ${a.details.fromCountry} to ${a.details.toCity}, ${a.details.toCountry} in ${a.details.timeDiffMinutes} min`,
        unusual_time:     a => `Login at unusual hour (${a.details.hour}:00 UTC)`,
      };
      for (const anomaly of anomalies) {
        const message = (anomalyMessages[anomaly.type] || (() => 'Suspicious login detected'))(anomaly);
        pushAlert(String(user._id), 'suspiciousLogin', { type: anomaly.type, severity: anomaly.severity, ip: ipAddress, userAgent, at: new Date().toISOString(), message });
        routeEvent('login_anomaly', { type: anomaly.type, severity: anomaly.severity, ip: ipAddress, userAgent, details: anomaly.details }, { userId: String(user._id) }).catch(() => {});
        if (anomaly.severity === 'critical') {
          sendSuspiciousLoginEmail?.(ipAddress, user.email).catch(() => {});
        }
      }
    }).catch(() => {});
    user.passwordStrength = getPasswordStrength?.(req.body.password);
    await user.save();

    return res.json({ message: 'Login successful. Proceed to OTP.', user: { id: user._id, email: user.email } });
  } catch (err) {
    console.error('Error during login:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});





const {
  GMAIL_CLIENT_ID,
  GMAIL_CLIENT_SECRET,
  GMAIL_REFRESH_TOKEN,
  GMAIL_USER
} = process.env;

const oAuth2Client = new google.auth.OAuth2(
  GMAIL_CLIENT_ID,
  GMAIL_CLIENT_SECRET,
  "https://developers.google.com/oauthplayground"
);
oAuth2Client.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN });


const resetTokens = new Map();

function generateResetCode() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit numeric code
}

// Rate limiter for forgot password to prevent abuse
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: { error: 'Too many password reset attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for reset password to prevent brute force
const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 reset attempts per windowMs
  message: { error: 'Too many password reset attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Function to clean up expired reset tokens
function cleanupExpiredTokens() {
  const now = Date.now();
  for (const [email, tokenData] of resetTokens.entries()) {
    if (tokenData.expiresAt <= now) {
      resetTokens.delete(email);
    }
  }
}

// Clean up expired tokens every 5 minutes
setInterval(cleanupExpiredTokens, 5 * 60 * 1000);

authRouter.post('/forgot-password', forgotPasswordLimiter, emailValidation, handleValidationErrors, async (req, res) => {
  const { email } = req.body;

  try {
    // ✅ Check if user with that email exists
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ error: 'No account found with this email address' });
    }

    // If user exists, proceed with sending reset code
    const resetCode = generateResetCode();
    const expirationTime = Date.now() + (10 * 60 * 1000); // 10 minutes from now
    resetTokens.set(email, { code: resetCode, expiresAt: expirationTime });

    try {
      await sendResetEmail(email, resetCode);
    } catch (emailErr) {
      console.error('Failed to send reset email:', emailErr);
      return res.status(500).json({ error: 'Failed to send reset code. Please try again.' });
    }

    res.status(200).json({ message: 'Reset code sent successfully.' });
  } catch (err) {
    console.error('Failed to process forgot password request:', err);
    res.status(500).json({ error: 'Failed to process forgot password request' });
  }
});

authRouter.post('/verify-reset-token', resetPasswordLimiter, emailValidation, resetTokenValidation, handleValidationErrors, async (req, res) => {
  const { email, token } = req.body;
  const tokenData = resetTokens.get(email);

  if (!tokenData) {
    return res.status(400).json({ error: 'No active reset request found for this email' });
  }

  if (tokenData.expiresAt <= Date.now()) {
    resetTokens.delete(email);
    return res.status(400).json({ error: 'Reset code has expired. Please request a new one.' });
  }

  if (tokenData.code !== token) {
    return res.status(400).json({ error: 'Incorrect reset code' });
  }

  return res.status(200).json({ message: 'Reset code verified successfully' });
});

authRouter.post('/reset-password', resetPasswordLimiter, emailValidation, resetTokenValidation, newPasswordValidation, handleValidationErrors, async (req, res) => {
  const { email, token, newPassword } = req.body;
  const tokenData = resetTokens.get(email);

  if (!tokenData) {
    return res.status(400).json({ error: 'No active reset request found for this email' });
  }

  if (tokenData.expiresAt <= Date.now()) {
    resetTokens.delete(email);
    return res.status(400).json({ error: 'Reset code has expired. Please request a new one.' });
  }

  if (tokenData.code !== token) {
    return res.status(400).json({ error: 'Incorrect reset code' });
  }

  // Check if password is not too common (basic check)
  const commonPasswords = ['password', '12345678', 'qwerty', 'password123', 'admin', 'letmein'];
  if (commonPasswords.includes(newPassword.toLowerCase())) {
    return res.status(400).json({ error: 'Password is too common. Please choose a stronger password.' });
  }

  // Save new password (hashed)
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await User.updateOne(
    { email },
    { $set: { password: hashedPassword, lastPasswordChange: new Date() } }
  );

  // Clear reset token after use
  resetTokens.delete(email);

  console.log(`✅ Password reset successful for ${email} at ${new Date().toISOString()}`);
  // Send HTTP 200 only — frontend will display its own modal/message
  return res.sendStatus(200);
});


authRouter.post('/send-otp', async (req, res) => {
  console.log("📬 /send-otp route called!");
  const { email } = req.body;

  try {
    // 🔍 1. Validate user existence
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'User not found' });

    // 🔢 2. Generate random OTP (6 digits)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

const role = user.role;

    // 🔏 3. Sign OTP inside a JWT (valid for 10 mins)
    const otpToken = jwt.sign(
      { email, otp, role },
      process.env.secretKeyOTP,
      { expiresIn: '5m' }
    );

    // 🔐 4. Get a fresh Gmail access token
    const accessTokenObj = await oAuth2Client.getAccessToken();
    const accessToken = accessTokenObj?.token;

    if (!accessToken) {
      console.error("❌ Failed to retrieve access token");
      return res.status(500).json({ error: 'Email service unavailable. Try again later.' });
    }

    // ✉️ 5. Create reusable transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: process.env.GMAIL_USER,
        clientId: process.env.GMAIL_CLIENT_ID,
        clientSecret: process.env.GMAIL_CLIENT_SECRET,
        refreshToken: process.env.GMAIL_REFRESH_TOKEN,
        accessToken
      },
    });

    // 📨 6. Email Template
    const mailOptions = {
      from: `Seekurify 🔐 <${process.env.GMAIL_USER}>`,
      to: email,
      subject: '🔒 Your One-Time Password (OTP)',
      text: `Your OTP code is: ${otp}. It expires in 10 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 10px; overflow: hidden;">
          <div style="background-color: #4a90e2; color: white; text-align: center; padding: 20px;">
            <h2>Seekurify</h2>
            <p style="margin: 0;">Your Secure OTP</p>
          </div>
          <div style="padding: 30px; text-align: center;">
            <p style="font-size: 16px;">Hello,</p>
            <p style="font-size: 16px;">Use the OTP below to complete your login:</p>
            <p style="font-size: 24px; font-weight: bold; margin: 20px 0; color: #4a90e2;">${otp}</p>
            <p style="font-size: 14px; color: #555;">This OTP will expire in <strong>10 minutes</strong>.</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            <p style="font-size: 12px; color: #999;">If you did not request this OTP, please ignore this email.</p>
          </div>
          <div style="background-color: #f7f7f7; text-align: center; padding: 15px; font-size: 12px; color: #999;">
            © ${new Date().getFullYear()} Seekurify. All rights reserved.
          </div>
        </div>
      `,
    };

    // 🚀 7. Send the email
    const result = await transporter.sendMail(mailOptions);
    console.log("✅ OTP email sent:", result.response);

    // 🎯 8. Respond with OTP token
    res.json({
      message: 'OTP sent successfully to your email.',
      otpToken,
    });

  } catch (err) {
    // 🧯 9. Handle Gmail token or sendMail errors
    if (err.message?.includes("invalid_grant")) {
      console.error("⚠️ Refresh token expired or revoked. Reauthorize Gmail API.");
    } else {
      console.error("❌ Error in /send-otp:", err.message);
    }
    res.status(500).json({ error: 'Failed to send OTP email' });
  }
});



authRouter.post('/verify-otp', async (req, res) => {
  const { email, otp, otpToken } = req.body;

  if (!email || !otp || !otpToken || typeof otp !== 'string' || otp.length !== 6) {
    return res.status(400).json({ error: 'Invalid request data' });
  }

  try {
    const decoded = jwt.verify(otpToken, process.env.secretKeyOTP);

    if (decoded.email !== email) {
      return res.status(400).json({ error: 'Email does not match token' });
    }

    if (decoded.otp !== otp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('❌ Error verifying OTP JWT:', err.message);
    if (err.name === 'TokenExpiredError') {
      return res.status(400).json({ error: 'OTP expired' });
    }
    return res.status(400).json({ error: 'Invalid OTP token' });
  }
});




authRouter.post('/verify-pin', async (req, res) => {
  const { email, pin, source } = req.body;

  if (!email || !pin || typeof pin !== 'string' || pin.length !== 4) {
    return res.status(400).json({ error: 'Invalid PIN or email' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'User not found' });

    const storedPin = user.pin; // assume hashed PIN

    const isValidPin = await bcryptjs.compare(pin, storedPin);
    if (!isValidPin) return res.status(400).json({ error: 'Invalid PIN' });

    // -----------------------------------------------
    // ✔️ Check if password change is required
    // -----------------------------------------------
    let shouldForcePasswordChange = false;

const failedLogins = await LoginEvent.find({
  userId: user._id,
  success: false
})
.sort({ timestamp: 1 }) // oldest → newest
.select('timestamp');

let suspiciousWindowEnd =null;

for (let i = 0; i <= failedLogins.length - 5; i++) {
  const windowStart = failedLogins[i].timestamp;
  const windowEnd = failedLogins[i + 4].timestamp;

  if (windowEnd.getTime() - windowStart.getTime() <= 5 * 60 * 1000) {
    suspiciousWindowEnd = windowEnd;
  }
}

// If suspicious window exists AND password not changed after it
if (
  suspiciousWindowEnd &&
  (
    !user.lastPasswordChange ||
    (user.lastPasswordChange.getTime && user.lastPasswordChange.getTime() === 0) ||
    user.lastPasswordChange <= suspiciousWindowEnd
  )
) {
  shouldForcePasswordChange = true;
}

// ---------------------------------------------
// CONDITION 2: Password older than 30 days
// ---------------------------------------------

const THIRTY_DAYS_AGO = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

if (
  user.lastPasswordChange &&
  user.lastPasswordChange.getTime &&
  user.lastPasswordChange.getTime() > 0 &&
  user.lastPasswordChange < THIRTY_DAYS_AGO
) {
  shouldForcePasswordChange = true;
}

    // -----------------------------------------------

    const tokenExpiry = source === 'extension' ? '7d' : '15m';
    const token = jwt.sign(
      { _id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: tokenExpiry }
    );

    const successfulLoginCount = await LoginEvent.countDocuments({
      userId: user._id,
      success: true,
    });

    return res.json({ 
      token,
      shouldForcePasswordChange,
      isFirstLogin: successfulLoginCount === 1,
      ownedFeatureFlags: user.ownedFeatureFlags || [],
    });

  } catch (err) {
    console.error('❌ Error verifying PIN:', err instanceof Error ? err.message : err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});



export const updatePin = async (req, res) => {
  const { email, newPin } = req.body;

  // Basic validation
  if (!email || !newPin || newPin.length !== 4) {
    return res.status(400).json({ message: 'Invalid email or PIN format' });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) return res.status(404).json({ message: 'User not found' });

    // Hash the new PIN before saving
    const salt = await bcrypt.genSalt(10);
    const hashedPin = await bcrypt.hash(newPin, salt);

    user.pin = hashedPin;
    await user.save();

    return res.status(200).json({ message: 'PIN updated successfully' });
  } catch (err) {
    console.error('Error updating PIN:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};


authRouter.get('/:userId', async (req, res, next) => {
  const { userId } = req.params;
  if (!mongoose.isValidObjectId(userId)) return next();
  try {
    const count = await LoginEvent.countDocuments({ userId });
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching login events' });
  }
});


authRouter.get('/user', async (req, res) => {
  const { pin } = req.query;

  if (!pin) {
    return res.status(400).json({ error: 'PIN is required' });
  }

  try {
    const user = await User.findOne({ pin });

    if (!user) {
      return res.status(404).json({ error: 'User not found for provided PIN' });
    }

    return res.status(200).json({
      id: user._id,
      email: user.email,
      pin: user.pin, // You can omit this if it’s sensitive
    });
  } catch (err) {
    console.error('Error in /api/user/:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});



authRouter.post("/signup", async (req, res) => {
  const { email, username, password } = req.body;

  // 1️⃣ Validate input
  if (!email || !username || !password)
    return res.status(400).json({ error: "All fields are required." });

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email))
    return res.status(400).json({ error: "Invalid email format." });

  try {
    // 2️⃣ Check existing user
    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ error: "Email is already in use." });

    // 3️⃣ Save user (you already hash elsewhere)
    const newUser = new User({
      email,
      username,
      password,
      userType: DEFAULT_USER_TYPE,
      ownedFeatureFlags: DEFAULT_OWNED_FLAGS,
    });
    await newUser.save();

    // 4️⃣ Create email verification token (15 min expiry)
  const emailToken = jwt.sign(
  { id: newUser._id, email, newUser: true },
  process.env.JWT_SECRET,
  { expiresIn: "5m" }
);

    const verifyLink = `${process.env.REACT_APP_BASE_URL}/set-new-pin?token=${emailToken}`;

    // 5️⃣ Set up Google OAuth2 client (auto-refresh)
    const oauth2Client = new OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI // must match in Google Cloud Console
    );

    oauth2Client.setCredentials({
      refresh_token: process.env.GMAIL_REFRESH_TOKEN,
    });

    const accessTokenResponse = await oauth2Client.getAccessToken();
    const accessToken = accessTokenResponse?.token;

    if (!accessToken) {
      console.error("❌ Failed to retrieve Gmail access token");
      return res.status(500).json({ error: "Email service unavailable." });
    }

    // 6️⃣ Configure Nodemailer transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: process.env.GMAIL_USER,
        clientId: process.env.GMAIL_CLIENT_ID,
        clientSecret: process.env.GMAIL_CLIENT_SECRET,
        refreshToken: process.env.GMAIL_REFRESH_TOKEN,
        accessToken,
      },
    });

    // 7️⃣ Prepare and send verification email
    const mailOptions = {
      from: `"Seekurify" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: "Verify Your Email & Set Your PIN - Seekurify",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
          <h2 style="color: #4a90e2;">Welcome to Seekurify, ${username}!</h2>
          <p>Click below to verify your email and set your secure PIN:</p>
          <a href="${verifyLink}"
             style="background-color:#007bff;color:#fff;padding:10px 15px;text-decoration:none;border-radius:5px;">
             Set Your PIN
          </a>
          <p style="color:#555;">This link is valid for 15 minutes.</p>
          <hr />
          <p style="font-size:12px;color:#888;">If you did not register, ignore this email.</p>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`📧 Verification email sent to ${email}`);
    } catch (emailErr) {
      console.error("❌ Failed to send email:", emailErr.message);
      return res
        .status(500)
        .json({ error: "User created, but failed to send verification email." });
    }

    // 8️⃣ Final response
    res.status(201).json({
      message:
        "User created successfully! Check your email to verify and set your PIN.",
    });
  } catch (err) {
    console.error("❌ Error during signup:", err.message);
    res.status(500).json({ error: "Internal server error." });
  }
});





authRouter.post('/update-pin', authenticateToken, async (req, res) => {
  const { newPin } = req.body;

  if (!newPin) {
    return res.status(400).json({ error: 'New PIN is required' });
  }

  if (newPin.length !== 4) {
    return res.status(400).json({ error: 'PIN must be exactly 4 digits' });
  }

  try {
    const userId = req.user.id;  // 🔥 FIX: trust JWT, not req.body.email
    const user = await User.findById(userId);

    if (!user) return res.status(404).json({ error: 'User not found' });

    user.pin = newPin;

    await Notification.create({
      userId,
      message: `🔐 Your PIN was successfully changed.`,
      type: "info",
    });

    await user.save();

    return res.status(200).json({ message: 'PIN updated successfully' });
  } catch (error) {
    console.error('Error in /update-pin:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});


authRouter.get('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id; 
    const user = await User.findById(userId).select('-password'); // exclude password

    if (!user) return res.status(404).json({ error: 'User not found' });

    // Compute passwordDaysLeft (example: expiry after 90 days)
    const PASSWORD_EXPIRY_DAYS = 90;

    let passwordDaysLeft = null;
    let isPasswordExpired = false;

    if (user.passwordLastUpdated) {
      const lastUpdated = new Date(user.passwordLastUpdated);
      const now = new Date();
      const diffMs = now.getTime() - lastUpdated.getTime();
      const diffDays = PASSWORD_EXPIRY_DAYS - Math.floor(diffMs / (1000 * 60 * 60 * 24));

      passwordDaysLeft = diffDays;
      isPasswordExpired = diffDays <= 0;
    }

    res.json({
      ...user.toObject(),
      passwordDaysLeft,
      isPasswordExpired
    });
  } catch (err) {
    console.error('Profile fetch error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


authRouter.post('/change-password', authenticateToken, async (req, res) => {
  const user = await User.findById(req.user._id); // now safe
  const { currentPassword, newPassword } = req.body;
  user.passwordStrength = getPasswordStrength(newPassword); // ✅ use correct field

  if (!user) return res.status(404).json({ error: 'User not found' });

  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) return res.status(400).json({ error: 'Current password is incorrect' });

  // const hashedNewPassword = await bcrypt.hash(newPassword, 10);
  user.password = newPassword;
  // Update password change timestamp for security checks
  user.lastPasswordChange = new Date();

  const site = "Seekurify"; // or get from req.body if provided
    const userId = user._id;
try {
  await Notification.create({
  userId,
  message: `🔐 Password for your "${site}" account was successfully changed.`,
  type: "info",
});
}
      catch (notifyErr) { 
          console.error("⚠️ Failed to create notification:", notifyErr);
        }



  await user.save();
 console.log('Received currentPassword:', req.body.currentPassword);
  console.log('Received newPassword:', req.body.newPassword);
  // Log password change event
  await PasswordChangeEvent.create({ userId: user._id });

  res.status(200).json({ message: 'Password changed successfully' });
});





const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const FEATURE_GROUP_TO_FLAGS = {
  identity: ["password_vault", "siem_dashboard"],
  threat: ["malware_analyzer", "phishing_detector", "deepfake_detector"],
  "ai-security": ["ai_red_team", "ai_agent_scanner", "prompt_injection", "pii_detector"],
  "web-infra": ["watch_agent", "site_shield", "csp_builder"],
  "team-workspaces": ["findings_board", "team_workspaces"],
  learn: ["security_awareness", "insights", "security_chatbot"],
};

const ALL_OWNED_FEATURE_FLAGS = Array.from(
  new Set(Object.values(FEATURE_GROUP_TO_FLAGS).flat())
);

const LEGACY_PLAN_TO_FLAGS = {
  free: [],
  pro: FEATURE_GROUP_TO_FLAGS.identity,
  premium: [
    ...FEATURE_GROUP_TO_FLAGS.threat,
    ...FEATURE_GROUP_TO_FLAGS["ai-security"],
  ],
  business: ALL_OWNED_FEATURE_FLAGS,
};

function mergeOwnedFeatureFlags(currentFlags = [], featureGroup, plan) {
  const merged = new Set(currentFlags);

  if (featureGroup === "bundle") {
    ALL_OWNED_FEATURE_FLAGS.forEach((flag) => merged.add(flag));
    return Array.from(merged);
  }

  if (featureGroup && FEATURE_GROUP_TO_FLAGS[featureGroup]) {
    FEATURE_GROUP_TO_FLAGS[featureGroup].forEach((flag) => merged.add(flag));
    return Array.from(merged);
  }

  if (plan && LEGACY_PLAN_TO_FLAGS[plan]) {
    LEGACY_PLAN_TO_FLAGS[plan].forEach((flag) => merged.add(flag));
  }

  return Array.from(merged);
}


authRouter.post("/create-order", authenticateToken, async (req, res) => {
  try {
    const { amount, currency = "INR", receipt } = req.body;

    if (!amount || isNaN(amount)) {
      return res.status(400).json({ success: false, message: "Invalid amount" });
    }

    const options = {
      amount: amount * 100, // Convert INR to paise
      currency,
      receipt: receipt || `receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);

    res.json({
      success: true,
      orderId: order.id,
      order,
      key: process.env.RAZORPAY_KEY_ID, // send key to frontend
    });
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    res.status(500).json({
      success: false,
      message: error?.description || error?.message || "Failed to create order",
    });
  }
});

// ----------------- PAYMENT SUCCESS -----------------
authRouter.post("/payment-success", authenticateToken, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan, featureGroup } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: "Incomplete payment details" });
    }

    const allowedPlans = ["free", "pro", "premium", "business"];
    if (!allowedPlans.includes(plan)) {
      return res.status(400).json({ success: false, message: "Invalid plan selected" });
    }

    const allowedFeatureGroups = ["identity", "threat", "ai-security", "web-infra", "team-workspaces", "learn", "bundle"];
    if (featureGroup && !allowedFeatureGroups.includes(featureGroup)) {
      return res.status(400).json({ success: false, message: "Invalid feature group selected" });
    }

    // Validate Razorpay signature
    const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
    hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const generatedSignature = hmac.digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: "Invalid payment signature" });
    }

    const user = await User.findById(req.user._id);

    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const nextOwnedFeatureFlags = mergeOwnedFeatureFlags(
      user.ownedFeatureFlags || [],
      featureGroup,
      plan
    );

    const nextUserType = resolveUserType(user.userType, featureGroup, plan);

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      {
        hasPaid: true,
        plan,
        razorpay_payment_id,
        razorpay_order_id,
        razorpay_signature,
        paymentDate: new Date(),
        ownedFeatureFlags: nextOwnedFeatureFlags,
        userType: nextUserType,
      },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      plan: updatedUser.plan,
      userType: updatedUser.userType,
      ownedFeatureFlags: updatedUser.ownedFeatureFlags || [],
    });

  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});



// ----------------- CHECK PAYMENT -----------------
// ==========================
// CHECK PAYMENT STATUS
// ==========================
authRouter.post("/check-payment", authenticateToken, async (req, res) => {
  try {
    const userId = req.user?._id;
    console.log("Decoded user:", req.user?._id);
    if (!userId) {
      return res.status(401).json({ hasPaid: false, message: "Unauthorized" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ hasPaid: false, message: "User not found" });
    }

    const trial = await Trial.findOne({ userId }).sort({ endDate: -1 });
    const now = new Date();

    let isTrialActive = false;
    let isTrialExpired = false;
    let trialEndDate = null;

    if (trial) {
      trialEndDate = trial.endDate;
      if (now <= new Date(trial.endDate)) {
        isTrialActive = true;
      } else {
        isTrialExpired = true;
      }
    }

    return res.status(200).json({
      hasPaid: !!user.hasPaid,
      plan: user.plan || "free",
      isTrialActive,
      isTrialExpired,
      trialEndDate,
    });
  } catch (err) {
    console.error("check-payment error:", err);
    res.status(500).json({ hasPaid: false, message: "Internal server error" });
  }
});

authRouter.post("/activate-free-plan", authenticateToken, async (req, res) => {
  try {
    const { featureGroup = "learn" } = req.body;
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (featureGroup !== "learn") {
      return res.status(400).json({ success: false, message: "Invalid free plan group" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const nextOwnedFeatureFlags = mergeOwnedFeatureFlags(
      user.ownedFeatureFlags || [],
      featureGroup,
      "free"
    );

    const nextUserType = resolveUserType(user.userType, featureGroup, "free");

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        plan: user.plan || "free",
        ownedFeatureFlags: nextOwnedFeatureFlags,
        userType: nextUserType,
      },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: "Free plan activated successfully",
      plan: updatedUser.plan || "free",
      userType: updatedUser.userType,
      ownedFeatureFlags: updatedUser.ownedFeatureFlags || [],
    });
  } catch (err) {
    console.error("activate-free-plan error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// ==========================
// START TRIAL
// ==========================
authRouter.post("/start-trial", authenticateToken, async (req, res) => {
  try {
const { plan } = req.body; // 🎯 Get the plan they actually chose!
    const userId = req.user?._id;
        if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const user = await User.findById(userId).select("hasPaid");
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.hasPaid) return res.status(400).json({ message: "Paid users cannot start a trial." });

    const activeTrial = await Trial.findOne({ userId, endDate: { $gte: new Date() } });
    if (activeTrial) return res.status(400).json({ message: "Active trial already exists" });

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 7);

    const newTrial = await Trial.create({ userId, startDate, endDate });
    // ✅ Store the actual plan ('free', 'pro', 'premium'), not 'trial'
    // The Trial collection tracks the trial status; the plan field should hold the selected tier
await User.findByIdAndUpdate(userId, { plan: plan || 'free' });

   return res.status(200).json({
      message: "Trial started successfully",
      trialActive: true,
      plan: plan || 'free',
      endDate,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to start trial" });
  }
});

authRouter.post("/check-user", authenticateToken, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ exists: false, error: "Email required" });
    }

    const user = await User.findOne({ email });

    if (user) {
      return res.json({ exists: true });
    } else {
      return res.status(404).json({ exists: false });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ exists: false, error: "Server error" });
  }
});

// GET /devices - Get all devices for the authenticated user
authRouter.post('/devices', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      console.error('User not authenticated in /devices');
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Fetch last 10 successful login events
    const loginEvents = await LoginEvent.find({ userId, success: true })
      .sort({ timestamp: -1 })
      .limit(10)
      .lean();

    if (!loginEvents || loginEvents.length === 0) {
      return res.json({ devices: [] }); // Safe fallback
    }

    // Transform login events to devices
    const devices = loginEvents.map(event => {
      const timestamp = event.timestamp ? new Date(event.timestamp) : new Date();
      const ipAddress = event.ipAddress || 'Unknown';
      const userAgent = event.userAgent || 'Unknown';
      const location = event.location || 'Unknown';

      return {
        deviceId: `${ipAddress}-${event._id || new mongoose.Types.ObjectId()}`,
        deviceType: 'desktop', // default
        browser: userAgent,
        os: 'Unknown',          // no parsing needed
        lastLogin: timestamp,
        ipAddress,
        location,
        status: timestamp > new Date(Date.now() - 24 * 60 * 60 * 1000) ? 'active' : 'inactive'
      };
    });

    return res.json({ devices });

  } catch (err) {
    console.error('Error in /devices route:', err);
    return res.status(500).json({
      error: 'Error fetching devices',
      details: err?.message || 'Unknown server error'
    });
  }
});


// POST /devices/logout - Log out from a specific device
authRouter.post('/devices/logout', authenticateToken, async (req, res) => {
  try {
    const { deviceId } = req.body;
    const userId = req.user._id;

    if (!deviceId) {
      return res.status(400).json({ error: 'Device ID is required' });
    }

    // Extract IP and UA from deviceId (assuming format: "ip-useragent")
    const [ipAddress, ...userAgentParts] = deviceId.split('-');
    const userAgent = userAgentParts.join('-');

    // Update the most recent login event for this device to mark it as logged out
    await LoginEvent.updateOne(
      {
        userId,
        ipAddress,
        userAgent,
        success: true
      },
      {
        $set: { loggedOut: true }
      }
    );

    res.json({ message: 'Device logged out successfully' });
  } catch (error) {
    console.error('Error logging out device:', error);
    res.status(500).json({ error: 'Failed to log out device' });
  }
});

// POST /devices/logout-all - Log out from all devices except current
authRouter.post('/devices/logout-all', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const currentDeviceId = req.body.currentDeviceId;

    if (!currentDeviceId) {
      return res.status(400).json({ error: 'Current device ID is required' });
    }

    const [currentIp, ...currentUaParts] = currentDeviceId.split('-');
    const currentUa = currentUaParts.join('-');

    await LoginEvent.updateMany(
      {
        userId,
        success: true,
        $or: [
          { ipAddress: { $ne: currentIp } },
          { userAgent: { $ne: currentUa } }
        ]
      },
      {
        $set: { loggedOut: true }
      }
    );

    res.json({ message: 'All other devices logged out successfully' });
  } catch (error) {
    console.error('Error logging out all devices:', error);
    res.status(500).json({ error: 'Failed to log out devices' });
  }
});

authRouter.post('/logout', authenticateToken, (req, res) => {
  // Clear cookies
  res.clearCookie('token'); // name of your cookie
  res.status(200).json({ message: 'Logged out successfully' });
});



// authRouter.post("/createNewNotification", authenticateToken, async (req, res) => {
//   try {
//     const { message, type } = req.body;
//     const userId = req.user.id;

//     const notification = await createNotification({ userId, message, type });
//     res.status(201).json(notification);
//   } catch (error) {
//     console.error("Error creating notification:", error);
//     res.status(500).json({ error: "Failed to create notification" });
//   }
// });


// Get all notifications for a user
// router.get("/", authenticateToken, async (req, res) => {
//   try {
//     const notifications = await Notification.find({ userId: req.user.id }).sort({ createdAt: -1 });
//     res.json(notifications);
//   } catch (error) {
//     console.error("Error fetching notifications:", error);
//     res.status(500).json({ error: "Failed to fetch notifications" });
//   }
// });


authRouter.post("/notifications", authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id; // JWT payload must have _id
    const notifications = await Notification.find({ userId }).sort({ createdAt: -1 });
    res.json(notifications);
  } catch (err) {
    console.error("Error fetching notifications:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ✅ Mark a single notification as read
authRouter.put("/:id/read", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId },
      { read: true },
      { new: true }
    );

    if (!notification)
      return res.status(404).json({ error: "Notification not found or not owned by user" });

    res.json({ success: true, notification });
  } catch (err) {
    console.error("Error marking notification as read:", err);
    res.status(500).json({ error: "Failed to mark notification as read" });
  }
});

// ✅ Optional: Mark all notifications as read
authRouter.put("/notifications/read-all", authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;
    await Notification.updateMany({ userId, read: false }, { read: true });
    res.json({ success: true, message: "All notifications marked as read" });
  } catch (err) {
    console.error("Error marking all notifications as read:", err);
    res.status(500).json({ error: "Failed to mark all notifications as read" });
  }
});


// 🔗 Create encrypted password share (client-side encrypted)
authRouter.post("/:id/share", authenticateToken, async (req, res) => {
  const { encryptedData, iv, salt, expiresAt, metadata, pin } = req.body;

  if (!encryptedData || !iv || !expiresAt) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // If a PIN is provided, validate and hash it; if omitted, verification will
  // fall back to the creator's stored account PIN.
  let pinHash = undefined;
  if (pin !== undefined) {
    if (typeof pin !== 'string' || !/^\d{4,6}$/.test(pin)) {
      return res.status(400).json({ error: 'Invalid PIN format. Must be 4-6 digits.' });
    }
    pinHash = await bcryptjs.hash(pin, 10);
  }

  try {
    const password = await Password.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!password) return res.status(404).json({ error: "Password not found" });

    const share = await passwordShare.create({
      encryptedData,
      iv,
      salt,
      expiresAt: new Date(expiresAt),
      metadata,
      pinHash,          // store hashed PIN (or undefined to use owner's account PIN)
      createdBy: req.user._id,
      oneTime: true,
      used: false,
      verified: false
    });

    res.status(201).json({ shareId: share._id });
  } catch (err) {
    console.error("Password share failed:", err);
    res.status(500).json({ error: err.message || "Server error" });
  }
});


// 🔓 Access shared password (one-time, no auth)
// 🔓 Access shared password (one-time, no auth / no OTP / no PIN)
authRouter.get("/share/:shareId", async (req, res) => {
  try {
    const { shareId } = req.params;
    const share = await passwordShare.findById(shareId);

    if (!share) return res.status(404).json({ error: "Invalid link" });

    // If share not explicitly verified, allow access when the requester
    // presents a valid JWT belonging to the share creator (owner).
    if (!share.verified) {
      const authHeader = req.headers['authorization'];
      if (authHeader) {
        const token = authHeader.split(' ')[1];
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          if (!decoded || (!decoded._id && !decoded.id)) {
            return res.status(403).json({ error: 'PIN not verified' });
          }

          const userIdFromToken = decoded._id || decoded.id;
          if (String(userIdFromToken) !== String(share.createdBy)) {
            return res.status(403).json({ error: 'PIN not verified' });
          }
          // If token belongs to the owner we allow access even if share.verified is false
        } catch (err) {
          return res.status(403).json({ error: 'PIN not verified' });
        }
      } else {
        return res.status(403).json({ error: 'PIN not verified' });
      }
    }

    if (share.expiresAt < new Date()) return res.status(410).json({ error: "Link expired" });
    if (share.oneTime && share.used) return res.status(403).json({ error: "Link already used" });

    // Return the encrypted payload to the client so decryption happens client-side
    // (the server intentionally does not hold the decryption secret)
    console.log(`Returning encrypted payload for shareId=${shareId}`);
    res.json({
      encryptedData: share.encryptedData,
      iv: share.iv,
      salt: share.salt,
      metadata: share.metadata || {},
      website: share.metadata?.website || "Unknown",
      viewOnce: share.oneTime === true
    });
  } catch (err) {
    console.error("Share access failed:", err);
    res.status(500).json({ error: "Server error" });
  }
});


// 🖥️ Fetch share metadata (SAFE – no secret)
authRouter.get("/share/:shareId/meta", async (req, res) => {
  try {
    console.log(`Incoming meta request for shareId=${req.params.shareId} from ip=${req.ip || req.headers['x-forwarded-for'] || 'unknown'}`);

    const share = await passwordShare.findById(req.params.shareId)
      .populate("createdBy", "email");

    if (!share) {
      return res.status(404).json({ error: "Invalid link" });
    }

    if (share.expiresAt < new Date()) {
      return res.status(410).json({ error: "Link expired" });
    }

    if (share.oneTime && share.used) {
      return res.status(403).json({ error: "Link already used" });
    }

    res.json({
      siteName: share.metadata?.website || "Unknown",
      sharedBy: share.createdBy?.email || "Someone",
      expiresAt: share.expiresAt,
      viewOnce: share.oneTime,
    });
  } catch (err) {
    console.error("Meta fetch failed:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /share/:shareId/consume - mark a one-time share as used after client confirms successful decryption
authRouter.post("/share/:shareId/consume", async (req, res) => {
  try {
    const { shareId } = req.params;

    // Atomic update: only mark as used if it wasn't already
    const updated = await passwordShare.findOneAndUpdate(
      { _id: shareId, oneTime: true, used: { $ne: true } },
      { $set: { used: true, usedAt: new Date() } },
      { new: true }
    );

    if (!updated) {
      // Either the share doesn't exist or was already used
      const existing = await passwordShare.findById(shareId);
      if (!existing) return res.status(404).json({ error: "Invalid link" });
      console.log(`Consume called but share ${shareId} already used`);
      return res.json({ success: true, alreadyUsed: true });
    }

    console.log(`Marked share ${shareId} as used`);
    return res.json({ success: true });
  } catch (err) {
    console.error("Consume endpoint failed:", err);
    res.status(500).json({ error: "Server error" });
  }
});



// 🔐 Verify shared password access (OTP / PIN step)
// 🔒 Verify shared password via PIN only
authRouter.post("/share/:shareId/verify", async (req, res) => {
  try {
    const { shareId } = req.params;
    const { pin } = req.body;

    // 1️⃣ Basic validation
    if (!pin || typeof pin !== "string") {
      return res.status(400).json({ error: "PIN is required" });
    }

    // 2️⃣ Fetch share
    const share = await passwordShare.findById(shareId);
    if (!share) {
      return res.status(404).json({ error: "Invalid share link" });
    }

    // 3️⃣ Expiry check (safe)
    if (share.expiresAt && share.expiresAt < new Date()) {
      return res.status(410).json({ error: "Share link expired" });
    }

    // 🚫 DO NOT check `used` here
    // This endpoint only verifies PIN

    // 4️⃣ Share must have its own PIN
    if (!share.pinHash) {
      return res.status(401).json({ error: "PIN not configured for this share" });
    }

    // 5️⃣ Compare PIN
    const pinMatches = await bcryptjs.compare(pin.trim(), share.pinHash);
    if (!pinMatches) {
      return res.status(401).json({ error: "Invalid PIN" });
    }

    // 6️⃣ Mark as verified
    share.verified = true;
    share.verifiedAt = new Date();
    await share.save();

    // 7️⃣ Success
    return res.json({
      success: true,
      message: "PIN verified successfully",
    });

  } catch (err) {
    console.error("Share PIN verification failed:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

authRouter.get("/public", async (req, res) => {
  try {
    const otpFlag = await FeatureFlag.findOne({
      key: "otp_verification",
    });

    // secure default = true
    res.json({
      otpEnabled: otpFlag ? otpFlag.enabled : true,
    });
  } catch (err) {
    res.status(500).json({ otpEnabled: true });
  }
});





authRouter.post("/check-domain", async (req, res) => {
  const { domain } = req.body;

  const found = await MaliciousDomain.findOne({ domain });

  if (found) {
    return res.json({
      knownMalicious: true,
      riskLevel: found.riskLevel
    });
  }

  return res.json({ knownMalicious: false });
});



authRouter.get('/security-context', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const now = new Date();
    const last7days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // 1. Password stats
    const passwords = await Password.find({ userId }).select('strength reused');
    const weakPasswords   = passwords.filter(p => p.strength === 'weak').length;
    const reusedPasswords = passwords.filter(p => p.reused === true).length;

    // 2. Recent brute force
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const failedLogins = await LoginEvent.countDocuments({
      userId,
      success: false,
      timestamp: { $gte: last24h }
    });
    const recentBruteForce = failedLogins >= 5;

    // 3. Recent failed login alerts
    const recentFailedLogins = await LoginEvent.find({
      userId,
      success: false,
      timestamp: { $gte: last7days }
    })
      .sort({ timestamp: -1 })
      .limit(5)
      .select('ipAddress userAgent timestamp')
      .lean();

    const recentAlerts = recentFailedLogins.map((login) => ({
      type: 'warning',
      message: `Failed login attempt from ${login.ipAddress}`,
      timestamp: login.timestamp,
    }));

    // 4. Suspicious login count
    const suspiciousLogins = await LoginEvent.countDocuments({
      userId,
      success: false,
      timestamp: { $gte: last24h }
    });

    // 5. Security score
    let score = 100;
    score -= weakPasswords * 10;
    score -= reusedPasswords * 8;
    if (recentBruteForce) score -= 20;
    score -= recentAlerts.filter((a) => a.type === 'critical').length * 15;
    score = Math.max(0, Math.min(100, score));

    // 6. Security status
    let securityStatus = 'good';
    if (score >= 80)      securityStatus = 'good';
    else if (score >= 60) securityStatus = 'fair';
    else if (score >= 40) securityStatus = 'poor';
    else                  securityStatus = 'critical';

    // 7. 🤖 Google Gemini AI — security recommendations
    let aiRecommendations = null;
    try {
      if (genAI) {
        const prompt = `
You are a cybersecurity assistant. Analyze the following user security data and provide 3 concise, actionable recommendations.

Security Data:
- Security Score: ${score}/100
- Security Status: ${securityStatus}
- Weak Passwords: ${weakPasswords}
- Reused Passwords: ${reusedPasswords}
- Failed Login Attempts (last 24h): ${suspiciousLogins}
- Brute Force Detected: ${recentBruteForce}
- Recent Alerts: ${recentAlerts.length}
- Total Passwords Managed: ${passwords.length}

Respond in JSON format only, like this:
{
  "summary": "One sentence overall assessment.",
  "recommendations": [
    { "priority": "high" | "medium" | "low", "action": "Short actionable tip" },
    { "priority": "high" | "medium" | "low", "action": "Short actionable tip" },
    { "priority": "high" | "medium" | "low", "action": "Short actionable tip" }
  ]
}`;

        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        // Strip markdown code fences if present
        const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
        aiRecommendations = JSON.parse(cleaned);
      } else {
        // no google client, skip the recommendation step entirely
      }
    } catch (aiErr) {
      console.warn('Gemini AI recommendation failed (non-fatal):', aiErr.message);
      // Fails gracefully — route still returns full security data
    }

    res.json({
      securityScore: score,
      securityStatus,
      weakPasswords,
      reusedPasswords,
      failedAttemptsLast24h: suspiciousLogins,
      recentBruteForce,
      recentAlerts: recentAlerts.slice(0, 5),
      totalPasswords: passwords.length,
      lastChecked: now,
      aiRecommendations, // 🤖 null if AI call failed
    });

  } catch (err) {
    console.error('Security context error:', err);
    res.status(500).json({ error: 'Failed to load security context' });
  }
});

export default authRouter;
