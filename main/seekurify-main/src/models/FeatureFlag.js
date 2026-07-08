import mongoose from "mongoose";

const FeatureFlagSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: { type: String },
  enabled: { type: Boolean, default: false },
 allowedRoles: {
  type: [String],
  default: ["admin"]
 },
  rolloutPercentage: { type: Number, default: 100 }
}, { timestamps: true, collection: 'featureflags' });


export default mongoose.model("featureflags", FeatureFlagSchema);
