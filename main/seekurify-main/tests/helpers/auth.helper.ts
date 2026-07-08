import { WebDriver, By, until } from 'selenium-webdriver';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173';
const EMAIL    = process.env.TEST_USER_EMAIL ?? '';
const PASSWORD = process.env.TEST_USER_PASSWORD ?? '';
const PIN      = process.env.TEST_USER_PIN ?? '';

export async function loginAsTestUser(driver: WebDriver): Promise<void> {
  await driver.get(`${BASE_URL}/login`);

  // email: type="text", id="email"
  const emailField = await driver.wait(until.elementLocated(By.id('email')), 8_000);
  await emailField.clear();
  await emailField.sendKeys(EMAIL);

  // password: type="password", id="password"
  const passwordField = await driver.findElement(By.id('password'));
  await passwordField.clear();
  await passwordField.sendKeys(PASSWORD);

  // Submit button is disabled while feature-flag API loads — wait for it
  const submitBtn = await driver.wait(until.elementLocated(By.css('button[type="submit"]')), 5_000);
  await driver.wait(until.elementIsEnabled(submitBtn), 8_000);
  await submitBtn.click();

  // Detect /warning redirect — means rate-limiter or suspicious-login check fired.
  // Fix: restart the backend server (clears in-memory rate limit).
  // The authLimiter in server.js is set to skip when NODE_ENV !== 'production'.
  await driver.sleep(1_000);
  const urlAfterSubmit = await driver.getCurrentUrl();
  if (urlAfterSubmit.includes('/warning')) {
    throw new Error(
      'Login redirected to /warning (rate limit or suspicious IP). ' +
      'Restart the backend server with `npm run dev:backend` to clear the limit.'
    );
  }

  // PIN step — appears inline on the same /login URL (no navigation).
  // PIN inputs: type="password", maxlength="1", 4 of them.
  // If OTP appears (6 inputs), OTP is still enabled — disable via Feature Flags.
  const pinOrOtpSelector = 'input[maxlength="1"]';
  let gotPin = false;
  try {
    await driver.wait(until.elementLocated(By.css(pinOrOtpSelector)), 12_000);
    const inputs = await driver.findElements(By.css(pinOrOtpSelector));
    if (inputs.length !== 4) {
      throw new Error(
        `OTP step appeared (${inputs.length} inputs). Disable OTP via the Feature Flags page.`
      );
    }
    gotPin = true;
    for (let i = 0; i < Math.min(PIN.length, inputs.length); i++) {
      await inputs[i].sendKeys(PIN[i]);
    }
    const pinSubmitBtn = await driver.findElement(By.css('button[type="submit"]'));
    await driver.wait(until.elementIsEnabled(pinSubmitBtn), 5_000);
    await pinSubmitBtn.click();
  } catch (err: any) {
    if (!gotPin) throw err;
  }

  // /homepageAfterLogin for returning users, /pricing for first-timers
  await driver.wait(until.urlMatches(/\/(homepageAfterLogin|pricing)/), 12_000);
}

export { BASE_URL };
export { restoreSession } from './session';
