import mongoose from 'mongoose';

const findingSchema = new mongoose.Schema(
  {
    patternId: { type: String, required: true },
    category:  { type: String, required: true },
    severity:  { type: String, enum: ['critical', 'high', 'medium', 'low'], required: true },
    description: String,
    remediation: String,
    codefix:     String,
    matchedText: String,
    position: {
      start: Number,
      end:   Number,
    },
  },
  { _id: false }
);

const injectionScanLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      index: true,
    },
    inputType:    { type: String, enum: ['text', 'file', 'url'], required: true },
    inputSummary: { type: String, maxlength: 300 },  // first ~200 chars for history display
    fileName:     String,  // if inputType === 'file'
    url:          String,  // if inputType === 'url'
    score:        { type: Number, required: true },
    riskLevel:    { type: String, enum: ['critical', 'high', 'medium', 'low', 'clean'], required: true },
    findings:     { type: [findingSchema], default: [] },
    mlResult: {
      topLabel:       String,
      topScore:       Number,
      scores:         { type: mongoose.Schema.Types.Mixed },
      isInjection:    Boolean,
      attackCategory: String,
      mlScore:        Number,
      novelDetection: Boolean,
    },
    semantic: {
      isInjection: Boolean,
      confidence:  Number,
      attackType:  String,
      reason:      String,
      error:       String,
    },
    agenticSim: {
      complied:     Boolean,
      toolsInvoked: { type: [{ name: String, input: mongoose.Schema.Types.Mixed, _id: false }], default: [] },
      agentResponse: String,
      error:         String,
    },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

injectionScanLogSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('InjectionScanLog', injectionScanLogSchema);
