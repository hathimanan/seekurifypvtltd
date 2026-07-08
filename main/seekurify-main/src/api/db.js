import 'dotenv'; // Load environment variables
import mongoose from 'mongoose';

const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/seekurify';

if (mongoose.connection.readyState === 0) {
  mongoose.connect(mongoURI, { bufferCommands: false });
}

const db = mongoose.connection;
db.on('error', (err) => {
  console.error('Connection error:', err);
});
db.once('open', () => {
  console.log('Connected to MongoDB');
});

export default db;