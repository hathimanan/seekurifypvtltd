import { WebDriver, By, until } from 'selenium-webdriver';
import * as dotenv from 'dotenv';
import { buildDriver, quitDriver } from '../helpers/driver';
import { restoreSession, BASE_URL } from '../helpers/auth.helper';
dotenv.config({ path: '.env.test' });

const PHISHING_SAMPLE = `From: security@paypa1.com
Subject: Urgent: Your account has been limited
Click here to verify: http://paypa1.com/login?token=abc123
Your account will be suspended unless you verify immediately.`;

const CLEAN_EMAIL = `From: newsletter@company.com
Subject: Weekly digest
Here are your top stories for the week. No action required.`;

describe('Threat Detection — Phishing Detector', () => {
  let driver: WebDriver;

  beforeAll(async () => {
    driver = await buildDriver();
    await restoreSession(driver);
    await driver.get(`${BASE_URL}/detect-attacker`);
    await driver.wait(until.elementLocated(By.css('textarea, [contenteditable="true"]')), 8_000);
  });

  afterAll(async () => {
    await quitDriver(driver);
  });

  test('phishing detector page loads with input area', async () => {
    const inputArea = await driver.findElement(By.css('textarea, [contenteditable="true"]'));
    expect(await inputArea.isDisplayed()).toBe(true);
  });

  test('suspicious email returns a risk result card', async () => {
    const inputArea = await driver.findElement(By.css('textarea, [contenteditable="true"]'));
    await inputArea.clear();
    await inputArea.sendKeys(PHISHING_SAMPLE);

    await driver.findElement(By.xpath('//button[contains(text(),"Scan") or contains(text(),"Analyz")]')).click();

    // Wait for a result — risk level badge, warning card, or score
    const resultEl = await driver.wait(
      until.elementLocated(
        By.xpath('//*[contains(@class,"result") or contains(@class,"risk") or contains(text(),"Phishing") or contains(text(),"risk") or contains(text(),"Risk")]')
      ),
      20_000
    );
    expect(await resultEl.isDisplayed()).toBe(true);
  });

  test('clean email shows low or no-risk result', async () => {
    const inputArea = await driver.findElement(By.css('textarea, [contenteditable="true"]'));
    await inputArea.clear();
    await inputArea.sendKeys(CLEAN_EMAIL);

    await driver.findElement(By.xpath('//button[contains(text(),"Scan") or contains(text(),"Analyz")]')).click();

    const resultEl = await driver.wait(
      until.elementLocated(
        By.xpath('//*[contains(text(),"Low") or contains(text(),"Safe") or contains(text(),"No phishing") or contains(text(),"Clean")]')
      ),
      20_000
    );
    expect(await resultEl.isDisplayed()).toBe(true);
  });

  test('empty submission shows validation message', async () => {
    await driver.findElement(By.xpath('//button[contains(text(),"Scan") or contains(text(),"Analyz")]')).click();
    await driver.sleep(1_000);

    const errorEl = await driver.findElements(
      By.css('[role="alert"], [class*="error" i], [class*="warning" i]')
    );
    // Either a validation error appears, or the button is disabled
    const submitBtn = await driver.findElement(By.css('button[type="submit"], button[class*="scan" i]'));
    const isDisabled = !(await submitBtn.isEnabled());
    expect(errorEl.length > 0 || isDisabled).toBe(true);
  });
});
