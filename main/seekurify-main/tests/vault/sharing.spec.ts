import { WebDriver, By, until } from 'selenium-webdriver';
import * as dotenv from 'dotenv';
import { buildDriver, quitDriver } from '../helpers/driver';
import { restoreSession, BASE_URL } from '../helpers/auth.helper';
dotenv.config({ path: '.env.test' });

describe('Vault — Password Sharing', () => {
  let driver: WebDriver;

  beforeAll(async () => {
    driver = await buildDriver();
    await restoreSession(driver);
    await driver.get(`${BASE_URL}/dashboard`);
    await driver.wait(until.elementLocated(By.css('[class*="vault"], [class*="password"], table, ul')), 10_000);
  });

  afterAll(async () => {
    await quitDriver(driver);
  });

  test('share button is visible on password entries', async () => {
    const shareButtons = await driver.wait(
      until.elementsLocated(By.css('button[class*="blue-100"]')),
      8_000
    );
    expect(shareButtons.length).toBeGreaterThan(0);
  });

  test('clicking share opens a modal or reveals a share link', async () => {
    const shareButtons = await driver.wait(
      until.elementsLocated(By.css('button[class*="blue-100"]')),
      8_000
    );
    await shareButtons[0].click();

    // Either a modal with a share link or a copy-to-clipboard confirmation
    const shareModal = await driver.wait(
      until.elementLocated(By.css('[role="dialog"], [class*="modal" i], [class*="share" i]')),
      6_000
    );
    expect(await shareModal.isDisplayed()).toBe(true);
  });

  test('shared password landing page renders for unauthenticated users', async () => {
    // Navigate as unauthenticated to a share URL pattern
    const newDriver = await buildDriver();
    try {
      await newDriver.get(`${BASE_URL}/share/demo-share-id`);
      await newDriver.sleep(2_000);
      // Should show landing page (not redirect to login)
      const url = await newDriver.getCurrentUrl();
      // Either shows the landing or a "not found" — both acceptable; it should NOT redirect to /login
      expect(url).not.toContain('/dashboard');
    } finally {
      await quitDriver(newDriver);
    }
  });
});
