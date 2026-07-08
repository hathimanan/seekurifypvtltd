import mongoose from 'mongoose';

const userLoginBaselineSchema = new mongoose.Schema({
  userId:           { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  typicalHours:     { type: [Number], default: [] },
  knownCountries:   { type: [String], default: [] },
  knownIPs:         { type: [String], default: [] },
  lastLoginAt:      { type: Date },
  lastLoginCountry: { type: String },
  lastLoginLat:     { type: Number },
  lastLoginLon:     { type: Number },
});

export default mongoose.model('UserLoginBaseline', userLoginBaselineSchema);
