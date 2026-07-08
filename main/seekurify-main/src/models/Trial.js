import mongoose from "mongoose";

const trialSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date, required: true },
  isActive: { type: Boolean, default: true },
});

export default mongoose.model("Trial", trialSchema);