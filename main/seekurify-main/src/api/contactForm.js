import express from 'express';
import jwt from 'jsonwebtoken';
import Contact from '../models/Contact.js'; // ✅ Ensure correct model path
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { google } from 'googleapis';
import multer from "multer";

const upload = multer({ storage: multer.memoryStorage() });

// dotenv.config({ path: '.env.development' });
const contactRouter = express.Router();
const OAuth2 = google.auth.OAuth2;

const oauth2Client = new OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  "https://developers.google.com/oauthplayground"
);

oauth2Client.setCredentials({
  refresh_token: process.env.GMAIL_REFRESH_TOKEN
});


async function sendEmail({ to, subject, text, attachments = [], formData = {} }) {
  try {
    const { token } = await oauth2Client.getAccessToken();

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: process.env.GMAIL_USER,
        clientId: process.env.GMAIL_CLIENT_ID,
        clientSecret: process.env.GMAIL_CLIENT_SECRET,
        refreshToken: process.env.GMAIL_REFRESH_TOKEN,
        accessToken: token,
      },
    });

    // ✅ Safe destructuring with defaults
    const { name = "N/A", email = "N/A", subject: formSubject = "N/A", message = "" } = formData || {};

    const mailOptions = {
      from: `Seekurify <${process.env.GMAIL_USER}>`,
      to,
      subject,
      text, // plain-text fallback
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #f9fafb; padding: 24px;">
          <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 24px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            
            <h2 style="color: #1e3a8a; font-size: 20px; font-weight: 700; margin-bottom: 16px;">
              📩 New Contact Form Submission
            </h2>

            <div style="margin-bottom: 16px;">
              <p style="margin: 4px 0; font-size: 14px; color: #374151;"><strong>Name:</strong> ${name}</p>
              <p style="margin: 4px 0; font-size: 14px; color: #374151;"><strong>Email:</strong> ${email}</p>
              <p style="margin: 4px 0; font-size: 14px; color: #374151;"><strong>Subject:</strong> ${formSubject}</p>
            </div>

            <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; color: #111827; font-size: 14px; line-height: 1.5;">
              ${(message || "").replace(/\n/g, "<br>")}
            </div>

            ${
              attachments.length > 0
                ? `<p style="margin-top: 16px; font-size: 14px; color: #374151;">
                    📎 Attachment included: <em>${attachments[0].filename}</em>
                  </p>`
                : ""
            }

            <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;" />
            <p style="font-size: 12px; color: #6b7280; text-align: center;">
              Sent securely via <strong>Seekurify</strong>
            </p>
          </div>
        </div>
      `,
      attachments,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent:", result.response);
    return result;
  } catch (err) {
    console.error("❌ Email error:", err.message || err);
    throw err;
  }
}




// 🔐 JWT Authentication Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization header missing' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Token missing in Authorization header' });
  }

  const secret = process.env.JWT_SECRET || process.env.secretKey;

  jwt.verify(token, secret, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    req.user = user;
    next();
  });
}

// 📩 POST /contact - Submit a contact message (protected route)
contactRouter.post('/contact', authenticateToken, upload.single("attachment"), async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    const file = req.file; // ✅ multer gives you file info

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const newMessage = new Contact({ name, email, subject, message });
    await newMessage.save();

    // 📩 Send email with optional attachment
    await sendEmail({
      to: process.env.GMAIL_USER,
      subject: `Contact Form: ${subject}`,
      text: `New message from ${name} <${email}>: ${message}`,
      attachments: file ? [
        {
          filename: file.originalname,
          content: file.buffer,
          contentType: file.mimetype,
        }
      ] : [],
      formData: { name, email, subject, message }
    });


    res.status(200).json({ message: 'Message received and email sent successfully' });
  } catch (error) {
    console.error("❌ Contact submission or email failed:", error.message);
    res.status(500).json({ error: 'Server error while submitting contact' });
  }
});



export default contactRouter;
