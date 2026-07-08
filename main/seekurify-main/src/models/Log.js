import  mongoose from "mongoose";

const logSchema = new mongoose.Schema({

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  event: {
    type: String,
    required: true
  },

  site: String,

  time: {
    type: Date,
    default: Date.now
  },

  meta: Object
});

export default mongoose.model("Log", logSchema);