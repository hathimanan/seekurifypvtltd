import { WebDriver, By, until } from 'selenium-webdriver';
import * as dotenv from 'dotenv';
import { buildDriver, quitDriver } from '../helpers/driver';
dotenv.config({ path: '.env.test' });

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173';

const uniqueEmail = () => `testuser_${Date.now()}@seekurify-test.com`;

describe('Auth — Signup', () => {
  let driver: WebDriver;

  beforeEach(async () => {
    driver = await buildDriver();
  });

  afterEach(async () => {
    await quitDriver(driver);
  });

  test('signup page loads correctly', async () => {
    await driver.get(`${BASE_URL}/signup`);
    const submitBtn = await driver.wait(until.elementLocated(By.css('button[type="submit"]')), 8_000);
    expect(await submitBtn.isDisplayed()).toBe(true);
  });

  test('duplicate email shows inline error', async () => {
    await driver.get(`${BASE_URL}/signup`);

    // email: type="text", id="email"
    const emailInput = await driver.wait(until.elementLocated(By.id('email')), 8_000);
    await emailInput.sendKeys(process.env.TEST_USER_EMAIL ?? '');

    await driver.findElement(By.id('username')).sendKeys('duplicate_user');

    const pwInputs = await driver.findElements(By.css('input[type="password"]'));
    await pwInputs[0].sendKeys('ValidPass123!');
    if (pwInputs[1]) await pwInputs[1].sendKeys('ValidPass123!');

    await driver.findElement(By.css('button[type="submit"]')).click();

    // Error shown as red text — look for any red-coloured element
    const errorEl = await driver.wait(
      until.elementLocated(By.css('[class*="red"], [class*="error"], [class*="Error"]')),
      8_000
    );
    expect(await errorEl.getText()).toBeTruthy();
  });

  test('mismatched passwords shows validation error', async () => {
    await driver.get(`${BASE_URL}/signup`);

    const emailInput = await driver.wait(until.elementLocated(By.id('email')), 8_000);
    await emailInput.sendKeys(uniqueEmail());

    await driver.findElement(By.id('username')).sendKeys('newuser_test');

    const pwInputs = await driver.findElements(By.css('input[type="password"]'));
    await pwInputs[0].sendKeys('ValidPass123!');
    if (pwInputs[1]) await pwInputs[1].sendKeys('DifferentPass456!');

    await driver.findElement(By.css('button[type="submit"]')).click();

    const errorEl = await driver.wait(
      until.elementLocated(By.css('[class*="red"], [class*="error"], [class*="Error"]')),
      6_000
    );
    expect(await errorEl.getText()).toBeTruthy();
  });

  test('empty form submission shows required field errors', async () => {
    await driver.get(`${BASE_URL}/signup`);

    // Click submit with empty form — React should render inline error text
    await driver.findElement(By.css('button[type="submit"]')).click();
    await driver.sleep(800);

    // Look for any visible error paragraph rendered by React validation
    const errors = await driver.findElements(By.css('p[class*="red"], span[class*="red"], [class*="error"]'));
    expect(errors.length).toBeGreaterThan(0);
  });

  test('PIN setup page renders after valid signup', async () => {
    await driver.get(`${BASE_URL}/signup`);

    const emailInput = await driver.wait(until.elementLocated(By.id('email')), 8_000);
    await emailInput.sendKeys(uniqueEmail());

    await driver.findElement(By.id('username')).sendKeys(`user_${Date.now()}`);

    const pwInputs = await driver.findElements(By.css('input[type="password"]'));
    await pwInputs[0].sendKeys('ValidPass123!');
    if (pwInputs[1]) await pwInputs[1].sendKeys('ValidPass123!');

    await driver.findElement(By.css('button[type="submit"]')).click();

    // After signup, app navigates to /set-new-pin or similar
    await driver.wait(
      async () => {
        const url = await driver.getCurrentUrl();
        return url.includes('/set-new-pin') || url.includes('/pin') || url.includes('/dashboard') || url.includes('/homepageAfterLogin');
      },
      15_000
    );
    const url = await driver.getCurrentUrl();
    expect(url).not.toContain('/signup');
  });
});
