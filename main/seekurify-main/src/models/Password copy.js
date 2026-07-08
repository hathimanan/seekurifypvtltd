const mongoose = require('mongoose');
const bcryptjs = require('bcryptjs');

const passwordSchema = new mongoose.Schema({
  website: { type: String, required: true },
  username: { type: String, required: true },
  password: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'users' },
});

passwordSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcryptjs.genSalt(10);
    this.password = await bcryptjs.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});



const Password = mongoose.model('passwords', passwordSchema);
module.exports = Password;
