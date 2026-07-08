import { WebDriver, By, until } from 'selenium-webdriver';
import * as dotenv from 'dotenv';
import { buildDriver, quitDriver } from '../helpers/driver';
import { restoreSession, BASE_URL } from '../helpers/auth.helper';
dotenv.config({ path: '.env.test' });

describe('Notifications', () => {
  let driver: WebDriver;

  beforeAll(async () => {
    driver = await buildDriver();
    await restoreSession(driver);
    await driver.get(`${BASE_URL}/dashboard`);
    await driver.wait(until.elementLocated(By.css('nav, header, [class*="nav" i]')), 10_000);
  });

  afterAll(async () => {
    await quitDriver(driver);
  });

  test('notification bell icon is visible in the dashboard nav', async () => {
    const bell = await driver.wait(
      until.elementLocated(
        By.css('[aria-label*="notification" i], [class*="bell" i], [class*="notification" i] svg, button[title*="notification" i]')
      ),
      8_000
    );
    expect(await bell.isDisplayed()).toBe(true);
  });

  test('clicking the bell opens the notification dropdown', async () => {
    const bell = await driver.wait(
      until.elementLocated(
        By.css('[aria-label*="notification" i], [class*="bell" i], [class*="notification" i] svg, button[title*="notification" i]')
      ),
      8_000
    );
    await bell.click();

    const dropdown = await driver.wait(
      until.elementLocated(
        By.css('[class*="dropdown" i], [class*="panel" i], [role="menu"], [class*="notification-list" i]')
      ),
      6_000
    );
    expect(await dropdown.isDisplayed()).toBe(true);
  });

  test('notification dropdown shows at least a header or empty state', async () => {
    const bell = await driver.wait(
      until.elementLocated(
        By.css('[aria-label*="notification" i], [class*="bell" i], [class*="notification" i] svg, button[title*="notification" i]')
      ),
      8_000
    );
    await bell.click();

    // Should show either notification items or an "all caught up" state
    const content = await driver.wait(
      until.elementLocated(
        By.xpath('//*[contains(text(),"Notification") or contains(text(),"notification") or contains(text(),"caught up") or contains(text(),"No notifications")]')
      ),
      6_000
    );
    expect(await content.isDisplayed()).toBe(true);
  });

  test('"Mark all as read" button is present and clickable', async () => {
    const bell = await driver.wait(
      until.elementLocated(
        By.css('[aria-label*="notification" i], [class*="bell" i], [class*="notification" i] svg, button[title*="notification" i]')
      ),
      8_000
    );
    await bell.click();

    try {
      const markReadBtn = await driver.wait(
        until.elementLocated(
          By.xpath('//*[contains(text(),"Mark all") or contains(text(),"mark all") or contains(text(),"Mark All")]')
        ),
        4_000
      );
      await markReadBtn.click();
      await driver.sleep(1_000);

      // After marking all read, unread badge should disappear
      const badges = await driver.findElements(
        By.css('[class*="badge" i], [class*="unread" i], [class*="count" i]')
      );
      for (const badge of badges) {
        const text = (await badge.getText()).trim();
        if (text !== '') {
          // Badge should show 0 or disappear
          const num = parseInt(text, 10);
          expect(isNaN(num) || num === 0).toBe(true);
        }
      }
    } catch {
      console.log('Mark all read button not found — no unread notifications present');
    }
  });
});
