import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { WebDriver } from 'selenium-webdriver';
dotenv.config({ path: '.env.test' });

const BASE_URL     = process.env.BASE_URL ?? 'http://localhost:5173';
const SESSION_FILE = path.join(__dirname, '../../.test-session.json');

interface SessionData {
  cookies: Array<Record<string, unknown>>;
  localStorage: Record<string, string>;
}

/**
 * Restores the saved browser session into `driver`.
 * Call this in beforeAll instead of loginAsTestUser to avoid a second login.
 * After this returns the driver is on BASE_URL with auth cookies and
 * localStorage set — navigate to your target page next.
 */
export async function restoreSession(driver: WebDriver): Promise<void> {
  if (!fs.existsSync(SESSION_FILE)) {
    throw new Error(
      '.test-session.json not found — did globalSetup run? Check that jest.config.cjs has globalSetup set.'
    );
  }

  const { cookies, localStorage }: SessionData = JSON.parse(
    fs.readFileSync(SESSION_FILE, 'utf-8')
  );

  // Must visit the origin before cookies can be written for it
  await driver.get(BASE_URL);

  for (const cookie of cookies) {
    try {
      await (driver.manage() as any).addCookie(cookie);
    } catch {
      // Server-set HttpOnly cookies may fail — that's fine, auth token is in localStorage
    }
  }

  if (Object.keys(localStorage).length) {
    await driver.executeScript((items: Record<string, string>) => {
      for (const [k, v] of Object.entries(items)) {
        window.localStorage.setItem(k, v);
      }
    }, localStorage);
  }
}
