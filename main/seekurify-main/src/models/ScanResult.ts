// models/ScanResult.ts
import mongoose, { Schema, Document, Types } from "mongoose";

export interface IScanResult extends Document {
  user?: Types.ObjectId | null;
  type: "file" | "url" | "search";
  fileName: string;
  sha256?: string;
  components: any[];
  overall: {
    risk: string;
    score: number;
    filesAnalyzed?: number;
    uncompressedBytes?: number;
  };
  virustotal?: Record<string, any>;
  iocs?: Record<string, any>;
  yaraMatches?: any[];
  behaviorAnalysis?: any[];
  aiExplanation?: Record<string, any>;
  notes?: string[];
  createdAt: Date;
}

const ScanResultSchema: Schema = new Schema<IScanResult>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: false, index: true },
    type: { type: String, enum: ["file", "url", "search"], required: true },
    fileName: { type: String, required: true },
    sha256: { type: String, index: true },
    components: {
      type: [
        {
          filename: String,
          sha256: String,
          size: Number,
          magic: String,
          mime: String,
          entropy: Number,
          indicators: [String],
          score: Number,
          risk: String,
          error: String,
          yaraMatches: { type: Schema.Types.Mixed },
          behaviorHits: { type: Schema.Types.Mixed },
          iocs: { type: Schema.Types.Mixed },
        }
      ],
      default: []
    },
    overall: {
      risk: { type: String },
      score: { type: Number },
      filesAnalyzed: { type: Number },
      uncompressedBytes: { type: Number },
    },
    virustotal: { type: Schema.Types.Mixed, default: null },
    iocs: { type: Schema.Types.Mixed, default: null },
    yaraMatches: { type: [Schema.Types.Mixed], default: [] },
    behaviorAnalysis: { type: [Schema.Types.Mixed], default: [] },
    aiExplanation: { type: Schema.Types.Mixed, default: null },
    notes: { type: [String], default: [] },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

export default mongoose.model<IScanResult>("ScanResult", ScanResultSchema);
