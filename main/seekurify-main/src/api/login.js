import express from 'express';
import bcryptjs  from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User  from '../models/User.ts';

const loginRouter = express.Router();

loginRouter.post('/', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isPasswordValid = await bcryptjs.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { _id: user._id, email: user.email, role: user.role },
      process.env.secretKey,
      { expiresIn: '3m' }
    );

    // console.log('Sending:', { email, password });


    res.json({ token });
  } catch (err) {
    console.error("Error during login:", err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default loginRouter;
