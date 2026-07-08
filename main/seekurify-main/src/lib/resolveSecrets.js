/**
 * resolveSecrets.js
 *
 * This module MUST be the first import in server.js.
 * It runs before any other module's body (ES module leaf execution order),
 * so process.env mutations here are visible to all subsequent module-level code.
 *
 * In production, Vercel injects env vars directly into process.env before the
 * process starts. JWT_PROD_SECRET and PASSWORD_ENCRYPTION_KEY_PROD are the
 * production-scoped names — we alias them to the standard names used throughout.
 */

import dotenv from 'dotenv';

const NODE_ENV = process.env.NODE_ENV || 'development';

// Load .env file for local dev/test (no-op on Vercel — vars already injected)
dotenv.config({
  path: NODE_ENV === 'production'
    ? '.env.production'
    : NODE_ENV === 'test'
    ? '.env.test'
    : '.env.development',
});

if (NODE_ENV === 'production') {
  if (process.env.JWT_PROD_SECRET) {
    process.env.JWT_SECRET = process.env.JWT_PROD_SECRET;
  }
  if (process.env.PASSWORD_ENCRYPTION_KEY_PROD) {
    process.env.PASSWORD_ENCRYPTION_KEY = process.env.PASSWORD_ENCRYPTION_KEY_PROD;
  }
}
