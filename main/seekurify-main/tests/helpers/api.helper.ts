import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });

const API_URL  = process.env.API_URL ?? 'http://localhost:5000';
const EMAIL    = process.env.TEST_USER_EMAIL ?? '';
const PASSWORD = process.env.TEST_USER_PASSWORD ?? '';
const PIN      = process.env.TEST_USER_PIN ?? '';

import * as fs   from 'fs';
import * as path from 'path';

const SESSION_FILE = path.join(__dirname, '../../.test-session.json');

// Cache the token for the entire Jest worker process — avoids one login per test suite.
let cachedToken: string | null = null;

/**
 * Returns a JWT for the test user.
 * First tries the token saved by globalSetup in .test-session.json (no login needed).
 * Falls back to the full login + PIN API flow only if the session file is absent.
 */
export async function getAuthToken(): Promise<string> {
  if (cachedToken) return cachedToken;

  if (fs.existsSync(SESSION_FILE)) {
    const { localStorage: ls } = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
    const token: string | undefined = ls?.token;
    if (token) {
      cachedToken = token;
      return cachedToken;
    }
  }

  // Fallback: globalSetup didn't run (e.g. running a single spec directly).
  const loginRes = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });

  if (!loginRes.ok) {
    const text = await loginRes.text();
    throw new Error(`Login failed (${loginRes.status}): ${text}`);
  }

  await loginRes.json(); // otpToken ignored — OTP must be disabled in test env

  const pinRes = await fetch(`${API_URL}/api/auth/verify-pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, pin: PIN }),
  });

  if (!pinRes.ok) {
    const text = await pinRes.text();
    throw new Error(`PIN verification failed (${pinRes.status}): ${text}`);
  }

  const pinData = await pinRes.json();
  if (!pinData.token) throw new Error('No token returned from PIN verification');

  cachedToken = pinData.token as string;
  return cachedToken;
}

export { API_URL };
