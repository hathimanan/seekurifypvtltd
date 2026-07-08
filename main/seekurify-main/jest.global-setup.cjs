/**
 * Jest globalSetup — runs once before any test file.
 * Logs in the test user via Selenium, saves cookies + localStorage to
 * .test-session.json so every subsequent spec can restore the session
 * without a second login.
 */
'use strict';

const path = require('path');
const fs   = require('fs');

require('dotenv').config({ path: path.join(__dirname, '.env.test') });

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173';
const EMAIL    = process.env.TEST_USER_EMAIL ?? '';
const PASSWORD = process.env.TEST_USER_PASSWORD ?? '';
const PIN      = process.env.TEST_USER_PIN ?? '';
const SESSION_FILE = path.join(__dirname, '.test-session.json');

module.exports = async function globalSetup() {
  const { Builder, By, until } = require('selenium-webdriver');
  const chrome = require('selenium-webdriver/chrome');
  const chromedriverPath = require('chromedriver').path;

  const service = new chrome.ServiceBuilder(chromedriverPath);
  const options = new chrome.Options();
  options.addArguments('--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--window-size=1280,800');

  const driver = await new Builder()
    .forBrowser('chrome')
    .setChromeService(service)
    .setChromeOptions(options)
    .build();

  try {
    await driver.get(`${BASE_URL}/login`);

    const emailField = await driver.wait(until.elementLocated(By.id('email')), 8_000);
    await emailField.clear();
    await emailField.sendKeys(EMAIL);

    const passwordField = await driver.findElement(By.id('password'));
    await passwordField.clear();
    await passwordField.sendKeys(PASSWORD);

    const submitBtn = await driver.wait(until.elementLocated(By.css('button[type="submit"]')), 5_000);
    await driver.wait(until.elementIsEnabled(submitBtn), 8_000);
    await submitBtn.click();

    await driver.sleep(1_000);
    const urlAfterSubmit = await driver.getCurrentUrl();
    if (urlAfterSubmit.includes('/warning')) {
      throw new Error(
        'globalSetup login hit rate-limit (/warning). Restart the backend server to clear it.'
      );
    }

    // PIN step
    const pinInputs = await driver.wait(until.elementsLocated(By.css('input[maxlength="1"]')), 12_000);
    if (pinInputs.length !== 4) {
      throw new Error(`Expected 4 PIN inputs, got ${pinInputs.length}. Disable OTP via Feature Flags.`);
    }
    for (let i = 0; i < Math.min(PIN.length, pinInputs.length); i++) {
      await pinInputs[i].sendKeys(PIN[i]);
    }
    const pinSubmit = await driver.findElement(By.css('button[type="submit"]'));
    await driver.wait(until.elementIsEnabled(pinSubmit), 5_000);
    await pinSubmit.click();

    await driver.wait(until.urlMatches(/\/(homepageAfterLogin|pricing)/), 12_000);

    // Save cookies
    const cookies = await driver.manage().getCookies();

    // Save localStorage
    const localStorage = await driver.executeScript(`
      const items = {};
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        items[key] = window.localStorage.getItem(key);
      }
      return items;
    `);

    fs.writeFileSync(SESSION_FILE, JSON.stringify({ cookies, localStorage }, null, 2));
    console.log('[globalSetup] Session saved to .test-session.json');
  } finally {
    const timeout = new Promise(resolve => setTimeout(resolve, 5_000));
    await Promise.race([driver.quit(), timeout]).catch(() => {});
  }
};
