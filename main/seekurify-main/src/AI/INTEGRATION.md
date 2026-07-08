# Seekurify — AI Features Integration Guide

## Files Created

```
seekurify/
├── services/
│   ├── phishingDetection.ts     ← Core AI phishing analysis logic
│   └── securityAssistant.ts     ← Context-aware chatbot logic
├── routes/
│   └── aiRoutes.ts              ← Express API endpoints
└── components/
    ├── PhishingDetector.tsx     ← Phishing detection UI
    └── SecurityAssistant.tsx    ← Chat assistant UI
```

---

## Step 1 — Install Dependencies

```bash
npm install @anthropic-ai/sdk
npm install --save-dev @types/node
```

---

## Step 2 — Environment Variable

Add to your `.env` file:
```
ANTHROPIC_API_KEY=process.env.ANTHROPIC_API_KEY
```

Get your API key from: https://console.anthropic.com

---

## Step 3 — Register Routes in Express

In your main `app.ts` or `server.ts`:

```typescript
import aiRoutes from "./routes/aiRoutes";

// Add after your existing routes
app.use("/api/ai", aiRoutes);
```

---

## Step 4 — Using the Phishing Detector Component

```tsx
import PhishingDetector from "./components/PhishingDetector";

// Drop it into your existing phishing page
export default function PhishingPage() {
  return (
    <div>
      <PhishingDetector />
    </div>
  );
}
```

---

## Step 5 — Using the Security Assistant

The assistant needs `userContext` — pull this from your existing MongoDB data.

```tsx
import SecurityAssistant from "./components/SecurityAssistant";

// Build context from your existing MongoDB collections
const userContext = {
  securityScore: 72,                    // from your scoring logic
  weakPasswords: 3,                     // count from password health logs
  reusedPasswords: 1,
  breachedEmails: [],                   // from HaveIBeenPwned checks
  twoFactorEnabled: true,
  recentAlerts: [                       // from your SIEM dashboard
    {
      type: "brute_force",
      severity: "high",
      message: "5 failed login attempts in 8 minutes",
      timestamp: new Date(),
      resolved: false
    }
  ],
  recentPhishingScans: [],              // from your phishing scan history
  recentLinkScans: [],                  // from your link checker history
  loginAnomalies: [],                   // from your SIEM login events
};

export default function AssistantPage() {
  return (
    <div style={{ height: "600px" }}>
      <SecurityAssistant
        userContext={userContext}
        sessionId={`session_${userId}`}   // unique per user
        onActionClick={(action, targetId) => {
          // Handle actions like "change_password", "enable_2fa"
          // Route to the relevant page in your app
          if (action === "change_password") navigate("/passwords");
          if (action === "enable_2fa") navigate("/settings/2fa");
          if (action === "review_login") navigate("/siem");
        }}
      />
    </div>
  );
}
```

---

## API Endpoints Summary

### Phishing Detection
```
POST /api/ai/phishing/analyze     — Analyze single email
POST /api/ai/phishing/batch       — Analyze up to 10 emails
```

### Security Assistant
```
POST /api/ai/assistant/chat       — Send message to assistant
POST /api/ai/assistant/summary    — Get security summary
DELETE /api/ai/assistant/session/:id — Clear conversation
```

---

## MongoDB Integration (Production Upgrade)

The `conversationStore` in `aiRoutes.ts` is currently in-memory.
For production, replace it with a MongoDB collection:

```typescript
// In your MongoDB schema, add:
const ConversationSchema = new Schema({
  sessionId: { type: String, required: true, unique: true },
  messages: [
    {
      role: { type: String, enum: ["user", "assistant"] },
      content: String,
      timestamp: { type: Date, default: Date.now },
    },
  ],
  updatedAt: { type: Date, default: Date.now },
});
```

---

## Connecting to Your SIEM Dashboard

To make the assistant aware of SIEM events, pass your login events:

```typescript
// Map your existing SIEM logs to the UserSecurityContext format
const loginAnomalies = siemLogs
  .filter(log => log.eventType === "INVALID_LOGIN" || log.eventType === "NEW_DEVICE")
  .map(log => ({
    timestamp: log.timestamp,
    type: log.eventType === "INVALID_LOGIN" ? "multiple_failures" : "new_device",
    description: log.message,
    severity: log.severity
  }));
```

---

## Cost Estimate (Anthropic API)

- Phishing analysis: ~500–800 tokens per scan ≈ $0.002–0.004 per analysis
- Assistant chat: ~300–600 tokens per message ≈ $0.001–0.003 per message
- For a small user base (~100 users, 10 scans/day): ~$2–5/month

Very affordable for a side project or early-stage product.
