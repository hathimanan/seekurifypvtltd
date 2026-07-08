import { WebDriver, By, until } from 'selenium-webdriver';
import * as dotenv from 'dotenv';
import { buildDriver, quitDriver } from '../helpers/driver';
import { restoreSession, BASE_URL } from '../helpers/auth.helper';
dotenv.config({ path: '.env.test' });

describe('Profile', () => {
  let driver: WebDriver;

  beforeAll(async () => {
    driver = await buildDriver();
    await restoreSession(driver);
    await driver.get(`${BASE_URL}/profile`);
    await driver.wait(until.elementLocated(By.css('[class*="profile" i], form, input[name="username"]')), 8_000);
  });

  afterAll(async () => {
    await quitDriver(driver);
  });

  test('profile page loads and shows form fields', async () => {
    const url = await driver.getCurrentUrl();
    expect(url).toContain('/profile');

    const formFields = await driver.findElements(By.css('input'));
    expect(formFields.length).toBeGreaterThan(0);
  });

  test('username field is editable', async () => {
    const usernameField = await driver.wait(
      until.elementLocated(By.css('input[name="username"], input[placeholder*="username" i]')),
      6_000
    );
    expect(await usernameField.isEnabled()).toBe(true);

    // Modify username
    await usernameField.clear();
    await usernameField.sendKeys('updated_test_user');

    const value = await usernameField.getAttribute('value');
    expect(value).toBe('updated_test_user');
  });

  test('save profile shows success feedback', async () => {
    const usernameField = await driver.wait(
      until.elementLocated(By.css('input[name="username"], input[placeholder*="username" i]')),
      6_000
    );
    const original = await usernameField.getAttribute('value');

    await usernameField.clear();
    await usernameField.sendKeys(`user_${Date.now()}`);

    await driver.findElement(By.css('button[type="submit"], button[class*="save" i], button[class*="update" i]')).click();

    const successEl = await driver.wait(
      until.elementLocated(
        By.xpath('//*[contains(text(),"saved") or contains(text(),"updated") or contains(text(),"success") or contains(@class,"success" )]')
      ),
      8_000
    );
    expect(await successEl.isDisplayed()).toBe(true);

    // Restore original username
    await usernameField.clear();
    await usernameField.sendKeys(original);
    await driver.findElement(By.css('button[type="submit"], button[class*="save" i]')).click();
    await driver.sleep(500);
  });

  test('change password with wrong current password shows error', async () => {
    // Find the change-password section / form
    const changePasswordSection = await driver.findElements(
      By.xpath('//*[contains(text(),"Change Password") or contains(text(),"change password")]')
    );
    if (changePasswordSection.length === 0) {
      console.log('Change password section not found on profile page — skipping');
      return;
    }

    const currentPwField = await driver.findElement(
      By.css('input[name="currentPassword"], input[placeholder*="current" i]')
    );
    await currentPwField.sendKeys('WrongCurrentPass999!');

    const newPwField = await driver.findElement(
      By.css('input[name="newPassword"], input[placeholder*="new password" i]')
    );
    await newPwField.sendKeys('NewPass123!');

    await driver.findElement(By.css('button[class*="change" i], button[class*="update" i]')).click();

    const errorEl = await driver.wait(
      until.elementLocated(By.css('[role="alert"], [class*="error" i]')),
      6_000
    );
    expect(await errorEl.isDisplayed()).toBe(true);
  });
});
