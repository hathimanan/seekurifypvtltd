// models/LoginEvent.model.js
import mongoose from 'mongoose';

const loginEventSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  success: {
    type: Boolean,
    required: true
  },
  ipAddress: String,
  userAgent: String,
  timestamp: {
    type: Date,
    default: Date.now
  },
  loggedOut: {
    type: Boolean,
    default: false
  },
  location: String
});

export default mongoose.model('LoginEvent', loginEventSchema);
