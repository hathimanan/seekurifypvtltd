// utils/createNotification.js
import Notification from "../models/Notification.model.js";

export async function createNotification({ userId, message, type = "info" }) {
  try {
    if (!userId || !message) {
      throw new Error("Missing required fields: userId or message");
    }

    const notification = await Notification.create({
      userId,
      message,
      type,
    });

    console.log("✅ Notification created:", notification.message);
    return notification;
  } catch (error) {
    console.error("❌ Error creating notification:", error.message);
    throw error;
  }
}
