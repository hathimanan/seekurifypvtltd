// --- Load environment variables and resolve production secret aliases ---
// MUST be the first import: runs before any other module's body (ES module leaf order)
import './src/lib/resolveSecrets.js';

import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import http from 'http';
import rateLimit from 'express-rate-limit';
import hpp from 'hpp';
import { body, query, param, validationResult } from 'express-validator';
import { initSocket } from './src/realtime/socketHub.js';
// In your Express app


// --- Paths for __dirname in ES modules ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Determine if production ---
const NODE_ENV = process.env.NODE_ENV || "development";
const PROD = NODE_ENV === "production";






// --- App setup ---
const app = express();
const PORT = process.env.PORT || 5000;

// --- CORS setup ---
// --- CORS setup ---
const allowedOrigins = PROD
  ? (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)
  : ['http://localhost:5173', 'http://localhost:5000', 'http://127.0.0.1:5173'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, Postman, curl)
    if (!origin) {
      return callback(null, true);
    }
    
    // Allow all Chrome extensions
    if (origin.startsWith('chrome-extension://')) {
      return callback(null, true);
    }
    
    // Allow specific origins from the list
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Reject everything else
    callback(new Error('Not allowed by CORS'));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
}));

// --- Security headers ---
const devCsp = {
  useDefaults: true,
  directives: {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'", "http://localhost:5173"],
    "style-src": ["'self'", "'unsafe-inline'", "http://localhost:5173"],
    "img-src": ["'self'", "data:", "blob:", "http://localhost:5173"],
    "connect-src": ["'self'", "ws://localhost:5000", "wss://localhost:5000", "http://localhost:5173"],
    "frame-ancestors": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"]
  }
};



const prodCsp = {
  useDefaults: true,
  directives: {
    "default-src": ["'self'"],
    "script-src": ["'self'"],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'"],
    "frame-ancestors": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "upgrade-insecure-requests": []
  }
};

app.use(helmet({
  contentSecurityPolicy: PROD ? prodCsp : devCsp,
  crossOriginEmbedderPolicy: false,
}));



// Extra Helmet hardening
app.use(helmet.referrerPolicy({ policy: 'no-referrer' }));
app.use(helmet.crossOriginOpenerPolicy());
app.use(helmet.crossOriginResourcePolicy({ policy: 'same-site' }));
app.use(helmet.originAgentCluster());
if (PROD) {
  app.use(helmet.hsts({
    maxAge: 60 * 60 * 24 * 365,
    includeSubDomains: true,
    preload: true
  }));
}


// app.use(
//   helmet({
//     contentSecurityPolicy: {
//       useDefaults: true,
//       directives: {
//         defaultSrc: ["'self'"],
//         imgSrc: ["'self'", "data:", "http://localhost:5000"],
//         scriptSrc: ["'self'", "'unsafe-inline'"],
//         styleSrc: ["'self'", "'unsafe-inline'"],
//       },
//     },
//   })
// );


// --- Trust proxy for secure cookies & HSTS ---
app.set('trust proxy', 1);
app.disable('x-powered-by');

// --- Body parsing ---
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));


// 1. Remove NoSQL injection operators
// --- Security Middleware ---

// 1. Prevent XSS attacks

// 2. Prevent HTTP Parameter Pollution
// --- Security Middleware ---

// 1. Prevent HTTP Parameter Pollution
app.use(hpp());

// 2. Comprehensive Security Sanitization (NoSQL Injection + XSS Protection)
app.use((req, res, next) => {
  const sanitizeString = (str) => {
    if (typeof str !== 'string') return str;
    
    // XSS Protection - Remove/escape dangerous HTML and scripts
    let cleaned = str
      // Remove script tags and content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      // Remove on* event handlers
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/on\w+\s*=\s*[^\s>]*/gi, '')
      // Remove javascript: protocol
      .replace(/javascript:/gi, '')
      // Remove data: protocol (can be used for XSS)
      .replace(/data:text\/html/gi, '')
      // NoSQL Injection Protection
      .replace(/[<>'"${}();]/g, '') // Remove special chars
      .replace(/(\$where|\$regex|\$ne|\$nin|\$in|\$gt|\$lt|\$lte|\$gte|\$exists|\$type)/gi, '') // Remove NoSQL operators
      .trim();
    
    return cleaned;
  };

  const sanitizeObject = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    
    const keysToDelete = [];
    
    for (const key in obj) {
      // Block dangerous keys (NoSQL injection + prototype pollution)
      if (
        key.startsWith('$') || 
        key.startsWith('_') || 
        key.includes('.') || 
        key.includes('constructor') || 
        key.includes('prototype') ||
        key.includes('__proto__')
      ) {
        keysToDelete.push(key);
        console.warn(`🚨 Security: Blocked dangerous key "${key}" from ${req.ip || 'unknown'}`);
        continue;
      }
      
      if (typeof obj[key] === 'string') {
        obj[key] = sanitizeString(obj[key]);
      } else if (Array.isArray(obj[key])) {
        obj[key] = obj[key].map(item => {
          if (typeof item === 'string') return sanitizeString(item);
          if (typeof item === 'object' && item !== null) {
            sanitizeObject(item);
            return item;
          }
          return item;
        });
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitizeObject(obj[key]);
      }
    }
    
    // Delete dangerous keys
    keysToDelete.forEach(key => delete obj[key]);
  };

  // Sanitize all input sources
  try {
    if (req.body && typeof req.body === 'object') {
      sanitizeObject(req.body);
    }
    if (req.query && typeof req.query === 'object') {
      sanitizeObject(req.query);
    }
    if (req.params && typeof req.params === 'object') {
      sanitizeObject(req.params);
    }
  } catch (error) {
    console.error('Sanitization error:', error);
    return res.status(400).json({ error: 'Invalid request data' });
  }

  next();
});


// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict limiter for auth routes — skip non-login endpoints like /security-context
const AUTH_LIMITER_SKIP_PATHS = ['/security-context'];
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Only 5 login attempts per 15 minutes
  message: { error: 'Too many login attempts, please try again later.' },
  skipSuccessfulRequests: true,
  // Skip rate limiting outside production so automated tests don't exhaust the limit
  skip: (req) =>
    process.env.NODE_ENV !== 'production' ||
    AUTH_LIMITER_SKIP_PATHS.some(p => req.path.endsWith(p)),
});

// Apply rate limiting
app.use('/api/', apiLimiter);
app.use('/api/auth', authLimiter);
app.use('/api/login', authLimiter);

// --- Database connection ---
import './src/api/db.js';

// --- Routers ---
import authRouter from './src/api/auth.js';
import loginRoutes from './src/api/login.js';
import dashboardRouter from './src/api/dashboard.js';
import passwordRoutes from './src/api/passwords.js';
import homepageBeforeloginRoutes from './src/api/homepageBeforelogin.js';
import homepageAfterLoginRoutes from './src/api/homepageAfterLogin.js';
import malwareAnalyzerRouter from './src/api/malwareanalyzer.js';
import contactRouter from './src/api/contactForm.js';
import SIEMDashboard from './src/api/siemDashboard.js';
import profileRoute from './src/api/profile.js';
import userSchema from './src/models/User.ts';
import botRouter from './src/routes/bot.ts';
import aiRouter from './src/AI/aiRoutes.ts';
import phishingRouter from './src/api/phishing.js';
import featureFlagRoutes from './src/routes/featureFlagRoutes.js';
import scanRouter from './src/api/scanServer.js';
import phishingServerRouter from './src/api/phishingServer.js';
import siteAuditRouter       from './src/routes/siteAudit.js';
import cspBuilderRouter      from './src/routes/cspBuilderRoute.js';
import webhookRouter         from './src/routes/webhookRoutes.js';
import injectionScanRouter   from './src/api/promptInjectionScan.js';
import scannerApiKeysRouter  from './src/routes/scannerApiKeys.js';
import watchlistRouter       from './src/routes/watchlistRoutes.js';
import deepfakeRouter        from './src/api/deepfakeDetector.js';
import aiAgentScannerRouter  from './src/api/aiAgentScanner.js';
import piiLeakageRouter      from './src/api/piiLeakageDetector.js';
import llmSiemRouter         from './src/api/llmSiem.js';
import redTeamRouter         from './src/api/redTeamScan.js';
import vulnerableMockRouter  from './src/api/vulnerableAiMock.js';
import workspaceRouter       from './src/routes/workspaceRoutes.js';
import findingRouter         from './src/routes/findingRoutes.js';
import cronRouter            from './src/routes/cronRoutes.js';
import hibpRouter            from './src/api/hibp.js';
import riskScoreRouter       from './src/api/riskScore.js';
import notificationsRouter   from './src/api/notifications.js';
import playbookRouter        from './src/api/playbooks.js';
import incidentRouter        from './src/api/incidents.js';
import integrationRouter     from './src/api/integrations.js';
import playbookRunRouter     from './src/api/playbookRuns.js';
import scanJobRouter         from './src/api/scanJobs.js';
import firewallRouter        from './src/api/firewall.js';
import identityRiskRouter    from './src/api/identityRisk.js';
import blastRadiusRouter     from './src/api/blastRadius.js';
import { startScheduler }    from './src/services/scanScheduler.js';


app.use('/api/homepage', homepageBeforeloginRoutes);
app.use('/api/auth', authRouter);
app.use('/api/login', loginRoutes);
app.use('/api/homepageAfterlogin', homepageAfterLoginRoutes);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/passwords', passwordRoutes);
app.use('/api/malware-analysis', malwareAnalyzerRouter);
app.use('/api', contactRouter);
app.use('/api', SIEMDashboard);
app.use('/api/profile', profileRoute);
app.use('/api/user', userSchema);
app.use('/api', botRouter);
app.use('/api/ai', aiRouter);
app.use('/api', phishingRouter);
app.use('/api/feature-flags', featureFlagRoutes);
app.use('/api', scanRouter);
app.use('/api', phishingServerRouter);
app.use('/api', siteAuditRouter);
app.use('/api', cspBuilderRouter);
app.use('/api', webhookRouter);
app.use('/api', injectionScanRouter);
app.use('/api', scannerApiKeysRouter);
app.use('/api', watchlistRouter);
app.use('/api', deepfakeRouter);
app.use('/api', aiAgentScannerRouter);
app.use('/api', piiLeakageRouter);
app.use('/api', llmSiemRouter);
app.use('/api', redTeamRouter);
app.use('/api', vulnerableMockRouter);
app.use('/api', workspaceRouter);
app.use('/api', findingRouter);
app.use('/api/cron', cronRouter);
app.use('/api/hibp', hibpRouter);
app.use('/api/risk-score', riskScoreRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api', playbookRouter);
app.use('/api', incidentRouter);
app.use('/api', integrationRouter);
app.use('/api', playbookRunRouter);
app.use('/api', scanJobRouter);
app.use('/api/firewall', firewallRouter);
app.use('/api', identityRiskRouter);
app.use('/api', blastRadiusRouter);
import logReportRouter from './src/api/logReport.js';
app.use('/api', logReportRouter);
import quizRouter from './src/api/quizQuestions.js';
app.use('/api', quizRouter);

// --- Serve static files from Vite build ---
app.use(express.static(path.join(__dirname, 'dist')));

// --- SPA fallback (non-API routes) ---
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// --- Global JSON error handler (must be last) ---
app.use((err, req, res, next) => {
  console.error('[Error]', err?.message || err);
  const status = err?.status || err?.statusCode || 500;
  res.status(status).json({ error: err?.message || 'Internal server error' });
});


const socketIoOptions = {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['polling', 'websocket'] // polling first is more tolerant behind proxies
};

const server = http.createServer(app);
initSocket(server, socketIoOptions);

// --- Start server (skip when running as a Vercel serverless function) ---
if (process.env.VERCEL !== '1') {
  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT} in ${NODE_ENV} mode`);
    startScheduler(6);
  });
}

export default server;

// --- Graceful shutdown ---
const shutdown = () => {
  console.log('🔻 Server shutting down...');
  if (NODE_ENV === 'development') {
    console.log('⚠️ In-memory sessions will be lost.');
  }
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
