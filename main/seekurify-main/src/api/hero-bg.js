import 'dotenv'; // Load environment variables
import mongoose from 'mongoose';

const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/seekurify';

mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on('error', (err) => {
  console.error('Connection error:', err);
  process.exit(1); // Exit the process on connection failure
});
db.once('open', () => {
  console.log('Connected to MongoDB');
});

export default db;