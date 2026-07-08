import mongoose from 'mongoose';

const passwordChangeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  timestamp: { type: Date, default: Date.now },
});

export default mongoose.model('PasswordChangeEvent', passwordChangeSchema);
