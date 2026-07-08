import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema({
  sessionId: { type: String, index: true, unique: true, required: true },
  messages: [{ role: { type: String }, content: { type: String } }],
  updatedAt: { type: Date, default: Date.now, expires: 3600 },
});

const Conversation = mongoose.models.Conversation || mongoose.model('Conversation', conversationSchema);

export default Conversation;
