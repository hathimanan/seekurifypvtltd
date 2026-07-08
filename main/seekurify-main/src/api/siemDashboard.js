import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

// import User from "../models/User.ts";
import Password from "../models/Password.js";
import LoginEvent from "../models/LoginEvent.model.js";
import PasswordChangeEvent from "../models/PasswordChangeEvent.model.js";
import { decrypt } from "../decryptor.js";

const SIEMDashboard = express.Router();

SIEMDashboard.use(cors());
SIEMDashboard.use(express.json());

/* ───────────────────────── AUTH MIDDLEWARE ───────────────────────── */

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Missing Authorization header" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Token missing" });
  }

  jwt.verify(
    token,
    process.env.JWT_SECRET,
    (err, decoded) => {
      if (err) {
        return res.status(403).json({ error: "Invalid or expired token" });
      }
      req.user = decoded;
      next();
    }
  );
}

/* ───────────────────────── DASHBOARD ROUTE ───────────────────────── */

SIEMDashboard.get("/siem-dashboard", authenticateToken, async (req, res) => {
  const { _id: userId, email } = req.user;
  const userObjectId = new mongoose.Types.ObjectId(userId);

  try {
    /* ───── LOGIN EVENTS (LAST 15 DAYS) ───── */
    const loginEventsAgg = await LoginEvent.aggregate([
      { $match: { userId: userObjectId } },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$timestamp",
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 15 },
    ]);

    const loginEvents = loginEventsAgg.map((e) => ({
      date: e._id,
      count: e.count,
    }));

    /* ───── PASSWORD CHANGE EVENTS ───── */
    const passwordChangeAgg = await PasswordChangeEvent.aggregate([
      { $match: { userId: userObjectId } },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$timestamp",
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 15 },
    ]);

    const passwordChanges = passwordChangeAgg.map((e) => ({
      date: e._id,
      count: e.count,
    }));

    /* ───── INVALID LOGIN DETECTION (15-MIN BUCKETS) ───── */
    const intervalMinutes = 15;

    const invalidLoginAgg = await LoginEvent.aggregate([
      {
        $match: {
          userId: userObjectId,
          success: false,
        },
      },
      {
        $group: {
          _id: {
            $toDate: {
              $subtract: [
                { $toLong: "$timestamp" },
                {
                  $mod: [
                    { $toLong: "$timestamp" },
                    intervalMinutes * 60 * 1000,
                  ],
                },
              ],
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const invalidLogins = invalidLoginAgg.map((e) => {
      const start = new Date(e._id);
      return {
        intervalStart: start.toISOString(),
        intervalEnd: new Date(
          start.getTime() + intervalMinutes * 60000
        ).toISOString(),
        count: e.count,
      };
    });

    /* ───── PASSWORD HEALTH (SAFE DECRYPTION) ───── */
    // Ensure we query by ObjectId (userObjectId) to avoid mismatches when userId is stored as ObjectId
    const savedPasswords = await Password.find({ userId: userObjectId }).lean();

    let poor = 0,
      medium = 0,
      good = 0,
      strong = 0;

    savedPasswords.forEach((pw) => {
      let plain;

      try {
        plain = decrypt(pw.password);
      } catch (err) {
        // Legacy or corrupted entry → skip safely
        return;
      }

      if (!plain || typeof plain !== "string") return;

      const len = plain.length;

      if (len <= 5) poor++;
      else if (len <= 10) medium++;
      else if (len <= 15) good++;
      else strong++;
    });

    const passwordHealth = [
      { category: "Poor", count: poor },
      { category: "Medium", count: medium },
      { category: "Good", count: good },
      { category: "Strong", count: strong },
    ];

    /* ───── RESPONSE ───── */
    res.status(200).json({
      message: `Welcome back, ${email}`,
      email,
      loginEvents,
      passwordChanges,
      invalidLogins,
      passwordHealth,
    });
  } catch (err) {
    console.error("❌ SIEM Dashboard Error:", err);
    res.status(500).json({ error: "Failed to load dashboard data" });
  }
});

export default SIEMDashboard;
