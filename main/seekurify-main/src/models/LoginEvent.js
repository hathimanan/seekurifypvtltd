import mongoose from 'mongoose';

const loginEventSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false,
    ref: 'User'
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  ipAddress: String,
  userAgent: String,
  success: Boolean,
  location: String,
  loggedOut: {
    type: Boolean,
    default: false
  }
});

export default mongoose.model('LoginEvent', loginEventSchema);