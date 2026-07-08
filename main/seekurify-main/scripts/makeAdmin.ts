import mongoose from "mongoose";
import User from "../src/models/User.ts";

import dotenv from "dotenv";
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/seekurify";

async function makeAdmin() {
await mongoose.connect(MONGODB_URI!);
  const email = "stranger2277553@gmail.com"; // your email

  const user = await User.findOneAndUpdate(
    { email },
    { role: "admin" },
    { new: true }
  );

  if (!user) {
    console.log("User not found");
  } else {
    console.log("User promoted to admin:", user.email);
  }

  process.exit(0);
}

makeAdmin();
