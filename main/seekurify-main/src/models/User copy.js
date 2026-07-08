const mongoose = require('mongoose');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  password: { type: String, required: true }
});

// Hash the password before saving
userSchema.pre('save', async function (next) {
  if (this.isModified('password')) { // <-- fix here
    try {
      const SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS, 10) || 10;
      this.password = await bcryptjs.hash(this.password, SALT_ROUNDS);
    } catch (err) {
      return next(err);
    }
  }
  next();
});

// Generate JWT token
userSchema.methods.generateAuthToken = function () {
  const secret = process.env.secretKey;
  if (!secret) {
    throw new Error('secretKey is not defined in the environment variables.');
  }
  return jwt.sign(
    { _id: this._id, email: this.email },
    secret,
    { expiresIn: '1h' }
  );
};

module.exports = mongoose.model('users', userSchema);
