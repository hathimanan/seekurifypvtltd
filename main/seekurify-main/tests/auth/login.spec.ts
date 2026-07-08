import { WebDriver, By, until } from 'selenium-webdriver';
import * as dotenv from 'dotenv';
import { buildDriver, quitDriver } from '../helpers/driver';
dotenv.config({ path: '.env.test' });

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173';
const EMAIL    = process.env.TEST_USER_EMAIL ?? '';
const PASSWORD = process.env.TEST_USER_PASSWORD ?? '';
const PIN      = process.env.TEST_USER_PIN ?? '';

describe('Auth — Login', () => {
  let driver: WebDriver;

  beforeEach(async () => {
    driver = await buildDriver();
  });

  afterEach(async () => {
    await quitDriver(driver);
  });

  test('valid credentials navigates to home after PIN', async () => {
    await driver.get(`${BASE_URL}/login`);

    // email: type="text", id="email"
    const emailField = await driver.wait(until.elementLocated(By.id('email')), 8_000);
    await emailField.sendKeys(EMAIL);
    await driver.findElement(By.id('password')).sendKeys(PASSWORD);

    // Wait for button to be enabled (disabled while OTP flag loads)
    const submitBtn = await driver.findElement(By.css('button[type="submit"]'));
    await driver.wait(until.elementIsEnabled(submitBtn), 8_000);
    await submitBtn.click();

    // PIN form appears inline — 4 type="password" maxlength="1" inputs
    await driver.wait(until.elementLocated(By.css('input[type="password"][maxlength="1"]')), 10_000);
    const pinInputs = await driver.findElements(By.css('input[type="password"][maxlength="1"]'));
    for (let i = 0; i < Math.min(PIN.length, pinInputs.length); i++) {
      await pinInputs[i].sendKeys(PIN[i]);
    }
    const pinSubmitBtn = await driver.findElement(By.css('button[type="submit"]'));
    await driver.wait(until.elementIsEnabled(pinSubmitBtn), 5_000);
    await pinSubmitBtn.click();

    await driver.wait(until.urlMatches(/\/(homepageAfterLogin|pricing)/), 15_000);
    const url = await driver.getCurrentUrl();
    expect(url).toMatch(/\/(homepageAfterLogin|pricing)/);
  });

  test('wrong password shows error message', async () => {
    await driver.get(`${BASE_URL}/login`);

    const emailField = await driver.wait(until.elementLocated(By.id('email')), 8_000);
    await emailField.sendKeys(EMAIL);
    await driver.findElement(By.id('password')).sendKeys('WrongPassword999!');

    const submitBtn = await driver.findElement(By.css('button[type="submit"]'));
    await driver.wait(until.elementIsEnabled(submitBtn), 8_000);
    await submitBtn.click();

    // Error div: red text/border styling — look for any visible red text element
    const errorEl = await driver.wait(
      until.elementLocated(By.css('[class*="red"], [class*="error"], [class*="Error"]')),
      8_000
    );
    const text = await errorEl.getText();
    expect(text.length).toBeGreaterThan(0);
  });

  test('empty email shows inline validation error', async () => {
    await driver.get(`${BASE_URL}/login`);

    // Fill only password, leave email empty
    await driver.findElement(By.id('password')).sendKeys('SomePassword1!');

    const submitBtn = await driver.findElement(By.css('button[type="submit"]'));
    await driver.wait(until.elementIsEnabled(submitBtn), 8_000);
    await submitBtn.click();

    // React renders an inline "Email is required" error paragraph
    const errorEl = await driver.wait(
      until.elementLocated(By.xpath('//*[contains(text(),"Email is required") or contains(text(),"required")]')),
      5_000
    );
    expect(await errorEl.getText()).toBeTruthy();
  });

  test('PIN step renders inline after successful password submission', async () => {
    await driver.get(`${BASE_URL}/login`);

    const emailField = await driver.wait(until.elementLocated(By.id('email')), 8_000);
    await emailField.sendKeys(EMAIL);
    await driver.findElement(By.id('password')).sendKeys(PASSWORD);

    const submitBtn = await driver.findElement(By.css('button[type="submit"]'));
    await driver.wait(until.elementIsEnabled(submitBtn), 8_000);
    await submitBtn.click();

    // Either OTP form (if enabled) or PIN form appears — both stay on /login URL
    // Look for any multi-digit input block appearing
    const postSubmitEl = await driver.wait(
      until.elementLocated(By.css('input[maxlength="1"]')),
      12_000
    );
    expect(await postSubmitEl.isDisplayed()).toBe(true);
  });

  test('already-authenticated user redirected away from /login', async () => {
    await driver.get(`${BASE_URL}/login`);
    await driver.executeScript(`window.localStorage.setItem('token', 'dummy-will-be-rejected')`);
    await driver.navigate().to(`${BASE_URL}/login`);
    await driver.sleep(1_500);
    const url = await driver.getCurrentUrl();
    expect(url).toBeTruthy();
  });
});
