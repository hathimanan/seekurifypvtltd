import mongoose, { Document, Schema, Model } from 'mongoose';
import bcryptjs from 'bcryptjs';

// 1. Define the interface for a User document
export interface IUser extends Document {
  email: string;
  username: string;
  password: string;
  resetToken?: string;
  resetTokenExpiry?: Date;
  otp?: string;
  otpEpiry?: Date;
  passwordStrength?: 'Poor' | 'Medium' | 'Good' | 'Strong';
  pin?: string;
  isModified(field: string): boolean;
  hasPaid?: boolean;
  name?: string;
  profileImage?: string;
  expiresAt?: Date;
  expireAfterDays?: number;
  lastReminderSent?: Date;
lastSuspiciousLogin: Date,
lastPasswordChange: Date,
plan?: 'free' | 'premium' | 'pro',
planAmount?: number,
role?: string
userType?: 'individual' | 'ai_teams' | 'security_professional' | 'enterprise';
ownedFeatureFlags?: string[];

}

// 2. Password strength checker
export function getPasswordStrength(password: string | undefined): 'Poor' | 'Medium' | 'Good' | 'Strong' {
  if (!password || typeof password !== 'string') return 'Poor';

  const length = password.length;

  if (length < 8) return 'Poor';
  else if (length >= 9 && length <= 16) return 'Medium';
  else if (length >= 17 && length <= 24) return 'Good';
  else return 'Strong';
}


// 3. Define schema
const userSchema: Schema<IUser> = new Schema({
  email: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  password: { type: String, required: true },
  resetToken: { type: String },
  resetTokenExpiry: { type: Date },
  otp: { type: String },
  otpEpiry: { type: Date },
  passwordStrength: { type: String, enum: ['Poor', 'Medium', 'Good', 'Strong'] },
  pin: { type: String },
  hasPaid: { type: Boolean, default: false }, // ✅ Add this
name: { type: String, required: false, trim: true },
profileImage: { type: String }, // Base64 or URL
  expiresAt: { type: Date },                       // actual expiry date
expireAfterDays: { type: Number, default: 90 },  // default expiry period
lastReminderSent: { type: Date },
lastSuspiciousLogin: { type: Date, default: Date.now },
lastPasswordChange: { type: Date, default: Date.now },
plan: { type: String, default: 'free' },
planAmount: { type: Number },
role: { type: String, default: 'user' },
userType: { type: String, enum: ['individual', 'ai_teams', 'security_professional', 'enterprise'], default: 'individual' },
ownedFeatureFlags: { type: [String], default: [] }

});

// 4. Hashing middleware
userSchema.pre<IUser>('save', async function (next) {
  try {
    if (this.isModified('password')) {
      this.passwordStrength = getPasswordStrength(this.password);
      const salt = await bcryptjs.genSalt(10);
      this.password = await bcryptjs.hash(this.password, salt);
    }

if (this.isModified('pin') && this.pin) {
  const salt = await bcryptjs.genSalt(10);
  this.pin = await bcryptjs.hash(this.pin, salt);
}

    next();
  } catch (error) {
    next(error as any);
  }
});

// 5. Export model
const User: Model<IUser> = mongoose.model<IUser>('User', userSchema);
export default User;
