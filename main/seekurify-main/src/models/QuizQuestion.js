import mongoose from 'mongoose';

const quizQuestionSchema = new mongoose.Schema({
  category:     { type: String, required: true },
  question:     { type: String, required: true },
  options:      [{ type: String, required: true }],
  correctIndex: { type: Number, required: true, min: 0, max: 3 },
  explanation:  { type: String, required: true },
}, { timestamps: true });

export default mongoose.model('QuizQuestion', quizQuestionSchema);
