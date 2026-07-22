# Seekurify

**Seekurify** is an all-in-one cybersecurity platform and secure password manager. It combines an encrypted credential vault with AI-powered security tools, real-time threat detection, incident response automation, and interactive security awareness training.

---

## Features

### Identity & Access
- **Secure Password Manager** — AES-256-GCM encrypted vault, strong password generator, breach detection, risk scoring, expiry tracking, and secure password sharing
- **SIEM Dashboard** — Security event aggregation, login analytics, password health charts, device session tracking, and LLM-specific threat events
- **Identity Risk Dashboard** — Score and surface risks across credentials and user identities
- **Blast Radius Analyzer** — Map the potential impact of a compromised credential or account

### Threat Detection
- **Malware Analyzer** — Upload and scan files for viruses, malware, and suspicious patterns
- **Phishing Detector** — AI-powered email and URL phishing analysis
- **Deepfake Detector** — AI-generated image and video detection
- **Breach Control** — HIBP-powered breach lookup and monitoring

### AI Security Suite
- **Red Team Agent** — Agentic AI-driven attack simulation
- **AI Agent Scanner** — Multi-model security probe for AI agents and LLM integrations
- **Prompt Injection Scanner** — 3-layer detection (regex + ONNX ML + Claude)
- **PII Leakage Detector** — Regex and AI-assisted sensitive data scanner

### Web & Infrastructure
- **Watch Agent** — Scheduled monitoring for URLs and endpoints
- **SiteShield Audit** — Full domain security audit (headers, SSL, DNS)
- **CSP Builder** — Interactive Content Security Policy generator and validator
- **Scheduled Scans** — Cron-based automated scan jobs

### SOAR (Security Orchestration, Automation & Response)
- **SOAR Center** — Unified view of incidents, playbooks, and automation status
- **Incident Dashboard** — Create, track, and resolve security incidents with severity and status management
- **Playbook Builder** — Build no-code automation playbooks triggered by incident conditions
- **Playbook Runs** — Execution history and status for each playbook trigger
- **Firewall** — Firewall event logging and rule management
- **Integration Hub** — Connect third-party services (Slack, webhooks, SIEM tools)

### Team & Collaboration
- **Findings Board** — Centralised security findings tracker across all modules
- **Team Workspaces** — Shared vaults and collaborative security management

### Learn & Stay Secure
- **Security Awareness** — Tips, attack simulations, breach checker, and interactive **Cyber Awareness Quiz** (20 India-focused questions, 10 per round, 30-second timer)
- **Insights** — Security trend summaries and recommendations
- **Security Chatbot** — AI assistant for security queries and guidance
- **User Guide** — In-app documentation for all platform features

### Platform
- **Feature Flags** — Admin-controlled on/off switches for every feature; no payment dependency
- **Log Report** — Structured audit log viewer
- **API Docs** — In-app REST API reference
- **Real-time Alerts** — Socket.IO suspicious login detection and notifications

---

## Chrome Extension

The Seekurify Chrome Extension is a **Manifest V3** browser extension that brings the platform's security capabilities directly into your browser. It opens as a **side panel** (Chrome 114+) and runs passive content scripts in the background — no popup, no interruption.

### Installation

1. Open `chrome://extensions` and enable **Developer mode**
2. Click **Load unpacked** and select the `extension/` folder
3. Click the Seekurify icon in the toolbar to open the side panel
4. Sign in with your Seekurify account (same credentials as the web app)

### Authentication

The extension uses a **4-step auth flow** mirroring the web app:

1. **Email + password** — credentials verified against the backend
2. **OTP** — 6-digit code sent to your email
3. **PIN** — 4-digit account PIN
4. **JWT** stored in `chrome.storage.local` — persists across browser sessions until you sign out

### Features

The side panel has **6 tabs**:

#### Vault
- Syncs your full password vault from Seekurify
- **Autofill** — detects login forms on the current page and injects credentials with one click
- **Save / update** — prompts to save new credentials or update existing ones after login
- **Search** across all stored passwords
- **Add / edit / delete** passwords directly from the extension

#### Audit
- **Site security audit** for the current domain — checks SSL/TLS, HTTP security headers, DNS records, and blacklist status
- Graded **A–F score** (0–100) with per-check pass/fail breakdown and actionable findings

#### Privacy (PII Monitor)
- Monitors prompts typed into **AI platforms**: ChatGPT, Claude, Gemini, Microsoft Copilot, Perplexity, Character.AI
- Detects **50+ PII types** including email, phone, address, national ID, credit card, passport, and India-specific identifiers (Aadhaar, PAN, DPDP categories)
- Real-time **session log** with detection count, submitted count, and critical-severity counter
- Toggle monitoring on/off per session; logs auto-clear on browser close (`chrome.storage.session`)

#### Inject (Injection Monitor)
- Detects **prompt injection and code injection** patterns in AI platform inputs
- Covers SQL injection, XSS, LDAP injection, NoSQL injection, template injection, and command injection
- Per-session log with severity breakdown; toggle independently of PII monitoring

#### Phishing (Email Phishing Detection)
- Passive content script on **Gmail, Outlook (live/office/365), Yahoo Mail, ProtonMail**
- Analyses open emails for phishing indicators — suspicious links, sender spoofing, urgency patterns, spear-phishing signals
- Session log with average risk score and critical-count summary

#### Breach
- **Full vault breach check** — hashes each stored password and checks against HaveIBeenPwned using **k-anonymity** (only the 5-character SHA-1 prefix is sent)
- **Site-level breach warning** — passive content script warns when the current site's domain appears in known breach data
- **Email breach check** — looks up your account email against HIBP breach database
- Shows pwned / clean / newly-found counts per scan

### Background Features (all pages)

These run silently on every website without requiring the side panel to be open:

| Feature | How it works |
|---------|-------------|
| **Link Scanner** | On-hover threat scoring for all hyperlinks — heuristic analysis + optional AI backend call |
| **QR Code Phishing Detection** | Uses the Chrome **BarcodeDetector API** to decode QR codes on-page and flag suspicious URLs |
| **Password Generator** | Inline generator injected into password fields; uses **WebCrypto API**; UI isolated in **Shadow DOM** to avoid style conflicts |
| **Autofill prompt** | Detects login forms on page load and shows a non-intrusive credential suggestion |

### Settings

Accessible via the ⚙ icon when signed in:

- **Seekurify server URL** — configurable API base (defaults to `http://localhost:5000`; update to your Vercel URL for production)
- **Link Scanner** toggle — enable/disable on-hover link threat scoring
- **Breach Check** toggle — enable/disable passive site breach warnings

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript + Vite |
| Backend | Express.js (Node.js) |
| Database | MongoDB (Mongoose) |
| Real-time | Socket.IO |
| AI/ML | Anthropic Claude, OpenAI, Google AI, LiteLLM, Xenova Transformers |
| Styling | Tailwind CSS + Shadcn UI + Framer Motion |
| Deployment | Vercel (serverless) |

---

## Prerequisites

- [Node.js](https://nodejs.org/) v22.6+ (required for TypeScript type stripping)
- MongoDB — local instance or [MongoDB Atlas](https://www.mongodb.com/atlas)

---

## Getting Started

```bash
npm install
```

---

## Environment Setup

Create the following files in the root directory. **Never commit these files** — they are gitignored.

### `.env.development` (local dev)
```env
MONGODB_URI=mongodb://localhost:27017/seekurify
PORT=5000

# Auth
JWT_SECRET=<your-dev-jwt-secret>
secretKey=<your-dev-secret-key>
secretKeyOTP=<your-dev-otp-secret>
SESSION_SECRET=<your-dev-session-secret>

# Email (Gmail OAuth2)
GMAIL_USER=<your-gmail>
GMAIL_CLIENT_ID=<your-client-id>
GMAIL_CLIENT_SECRET=<your-client-secret>
GMAIL_REFRESH_TOKEN=<your-refresh-token>

# Password encryption
PASSWORD_ENCRYPTION_KEY=<64-char-hex>

# AI (optional — pick one or more)
ANTHROPIC_API_KEY=<your-key>
OPENAI_API_KEY=<your-key>
GOOGLE_AI_API_KEY=<your-key>

# Local LiteLLM (for AI Security Assistant in dev)
LITELLM_API_KEY=lm-studio
LITELLM_API_BASE=http://127.0.0.1:5174/v1
LITELLM_MODEL=google/gemma-3-1b

# Other
GOOGLE_SAFE_BROWSING_API_KEY=<your-key>
HF_API_TOKEN=<your-key>
HIBP_API_KEY=<your-haveibeenpwned-api-key>  # required for /api/hibp/check-email and the MCP check_email_breach tool

# CORS & Socket
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5000
VITE_SOCKET_URL=http://localhost:5000

# Cron
CRON_SECRET=<random-secret>
```

### `.env.production` (Vercel production)
```env
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/seekurify?retryWrites=true&w=majority
PORT=5000

# Auth (use production-specific keys)
JWT_PROD_SECRET=<your-prod-jwt-secret>
secretKey=<your-secret-key>
secretKeyOTP=<your-otp-secret>
SESSION_SECRET=<your-session-secret>

# Password encryption (production-specific key)
PASSWORD_ENCRYPTION_KEY_PROD=<64-char-hex>

# Email
GMAIL_USER=<your-gmail>
GMAIL_CLIENT_ID=<your-client-id>
GMAIL_CLIENT_SECRET=<your-client-secret>
GMAIL_REFRESH_TOKEN=<your-refresh-token>

# AI
ANTHROPIC_API_KEY=<your-key>
OPENAI_API_KEY=<your-key>
GOOGLE_AI_API_KEY=<your-key>

# Other
GOOGLE_SAFE_BROWSING_API_KEY=<your-key>
HF_API_TOKEN=<your-key>
HIBP_API_KEY=<your-haveibeenpwned-api-key>  # required for /api/hibp/check-email and the MCP check_email_breach tool

# CORS & Socket
ALLOWED_ORIGINS=https://seekurify.vercel.app
VITE_SOCKET_URL=https://seekurify.vercel.app

# Cron
CRON_SECRET=<random-secret>

# Vercel
DISABLE_ML_WARMUP=1
```

> In production, `JWT_PROD_SECRET` is automatically aliased to `JWT_SECRET` and `PASSWORD_ENCRYPTION_KEY_PROD` to `PASSWORD_ENCRYPTION_KEY` via `src/lib/resolveSecrets.js`.

## Running the Application

### Development (frontend + backend together)
```bash
npm run dev:full
```

### Frontend only (Vite dev server)
```bash
npm run vite
```

### Backend only
```bash
npm run dev:backend
```

---

## Building for Production

```bash
npm run build
```

Output goes to `./dist/`. The Express server serves this directory as the SPA.

---

## Deployment (Vercel)

This project is configured for Vercel serverless deployment via `vercel.json`.

### Deployment pipeline
- **GitHub** → push to `main` → Vercel auto-deploys to production
- **Feature branches** → Vercel creates a preview deployment automatically

### Key serverless adaptations
- `server.js` exports the Express app as a handler (`export default server`)
- File uploads use `/tmp` on Vercel (ephemeral, cleaned after each request)
- Node-cron replaced with Vercel Cron Jobs (`/api/cron/nightly-watch`, `/api/cron/scheduled-scans`)
- AI conversation history persisted in MongoDB (not in-memory)
- ML model cache redirected to `/tmp/.model-cache`

### Environment variables
Set all variables from `.env.production` in Vercel → Project Settings → Environment Variables under the **Production** scope.

---

## API Endpoints (Key Routes)

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Register new user |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/forgot-password` | Send OTP |
| POST | `/api/auth/reset-password` | Reset password with OTP |

### Passwords
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/passwords` | Get all passwords |
| POST | `/api/passwords` | Add password |
| PUT | `/api/passwords/:id` | Update password |
| DELETE | `/api/passwords/:id` | Delete password |

### Security Tools
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/malware-analysis/scan` | Scan file for malware |
| POST | `/api/phishing/analyze` | Analyze email for phishing |
| POST | `/api/prompt-injection/scan` | Scan text for prompt injection |
| POST | `/api/pii/scan` | Scan for PII leakage |
| POST | `/api/red-team/scan` | Run red team simulation |
| POST | `/api/ai/assistant/chat` | Chat with AI security assistant |

### SOAR
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/incidents` | List / create incidents |
| GET/POST | `/api/playbooks` | List / create playbooks |
| GET | `/api/playbook-runs` | Playbook execution history |
| GET/POST | `/api/firewall` | Firewall events and rules |
| GET/POST | `/api/integrations` | Third-party integrations |

### Feature Flags (Admin)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/feature-flags/read` | Read current flag state (authenticated) |
| POST | `/api/feature-flags/toggle` | Enable / disable a flag |
| POST | `/api/feature-flags/assign-user-type` | Assign user tier |

### MCP Server
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/mcp` | Model Context Protocol (Streamable HTTP, stateless) endpoint. Requires `Authorization: Bearer <token>`, same JWT as the rest of the API. |

Exposes 4 read-only tools for MCP clients (e.g. Claude Desktop, Claude Code, `npx @modelcontextprotocol/inspector`): `check_password_breach`, `check_email_breach`, `list_vault_entries` (metadata only — never returns the password field), and `ask_security_assistant`. No write access and no decrypted-password access are exposed via MCP.

### Cron (Vercel-triggered)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/cron/nightly-watch` | Nightly watchlist scan (2 AM) |
| GET | `/api/cron/scheduled-scans` | Scheduled watchlist scans (every minute) |

> Cron endpoints require `Authorization: Bearer <CRON_SECRET>` header.

---

## Security Architecture

- **AES-256-GCM** encryption for stored passwords
- **bcrypt** password hashing
- **JWT** authentication with production-specific secrets
- **Rate limiting** — 100 req/15min general, 5 req/15min on auth routes
- **Helmet.js** security headers with strict production CSP
- **CORS** restricted to configured origins per environment
- **Input sanitization** — XSS and NoSQL injection protection on all requests
- **HPP** (HTTP Parameter Pollution) protection

---

## AI Features

| Feature | Provider | Works in Production |
|---------|----------|-------------------|
| AI Agent Scanner | LiteLLM → Google → Anthropic | ✅ (with API key) |
| Phishing Detection | LiteLLM → Google → Anthropic | ✅ (with API key) |
| Prompt Injection (ML) | Xenova ONNX (local) | ✅ Always |
| Prompt Injection (Claude) | Anthropic | ✅ (with API key) |
| Red Team Scanner | Anthropic | ✅ (with API key) |
| PII Leakage | Regex only | ✅ Always |
| LLM SIEM | Aggregation only | ✅ Always |
| Security Assistant | LiteLLM (local) | ⚠️ Dev only — configure cloud provider for production |

---

## Feature Flags

All features are controlled by admin-managed flags stored in MongoDB. Flags are simple on/off toggles — there is no payment or subscription dependency. Admins can enable or disable any feature for all users via the Feature Flags admin panel (`/admin/feature-flags`).

---

## License

Private — All rights reserved.
