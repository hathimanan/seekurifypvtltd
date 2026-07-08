import mongoose from "mongoose";

const MaliciousDomainSchema = new mongoose.Schema({
  domain: { type: String, required: true, unique: true },
  riskLevel: { type: String, enum: ["LOW", "MEDIUM", "HIGH"], default: "HIGH" },
  source: { type: String }, // PhishTank, OpenPhish, manual
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("MaliciousDomain", MaliciousDomainSchema);
