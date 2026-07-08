import mongoose from 'mongoose';
import crypto   from 'crypto';

const webhookSchema = new mongoose.Schema(
  {
    userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false, index: true },
    name:         { type: String, required: true, trim: true },
    targetUrl:    { type: String, required: true },
    webhookUrl:   { type: String, required: true },
    webhookType:  { type: String, enum: ['slack', 'github', 'custom'], default: 'custom' },
    token:        { type: String, required: true, unique: true, default: () => crypto.randomBytes(24).toString('hex') },
    threshold:    { type: Number, default: 70, min: 0, max: 100 },
    active:       { type: Boolean, default: true },
    lastRunAt:    { type: Date },
    lastScore:    { type: Number },
    lastGrade:    { type: String },
    lastStatus:   { type: String, enum: ['passed', 'failed', 'error'], default: null },
  },
  { timestamps: true }
);

export default mongoose.model('Webhook', webhookSchema);
