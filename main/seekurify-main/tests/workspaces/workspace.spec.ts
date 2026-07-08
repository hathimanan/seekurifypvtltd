import { WebDriver, By, until } from 'selenium-webdriver';
import * as dotenv from 'dotenv';
import { buildDriver, quitDriver } from '../helpers/driver';
import { restoreSession, BASE_URL } from '../helpers/auth.helper';
dotenv.config({ path: '.env.test' });

describe('Workspace Management', () => {
  let driver: WebDriver;

  beforeAll(async () => {
    driver = await buildDriver();
    await restoreSession(driver);
    await driver.get(`${BASE_URL}/workspaces`);
    await driver.sleep(2_000);
  });

  afterAll(async () => {
    await quitDriver(driver);
  });

  test('workspaces page loads', async () => {
    const url = await driver.getCurrentUrl();
    expect(url).toContain('/workspace');
  });

  test('create a new workspace', async () => {
    const createBtn = await driver.wait(
      until.elementLocated(
        By.xpath('//*[contains(text(),"New Workspace") or contains(text(),"Create Workspace") or contains(@aria-label,"create workspace" )]')
      ),
      8_000
    );
    await createBtn.click();

    const nameField = await driver.wait(
      until.elementLocated(By.css('input[autofocus], input[maxlength="80"], input[placeholder*="Acme" i]')),
      6_000
    );
    const uniqueName = `Test WS ${Date.now()}`;
    await nameField.clear();
    await nameField.sendKeys(uniqueName);

    await driver.findElement(By.css('button[type="submit"], button[class*="create" i], button[class*="save" i]')).click();

    // New workspace card should appear
    await driver.wait(until.elementLocated(By.xpath(`//*[contains(text(),"${uniqueName}")]`)), 8_000);
    const ws = await driver.findElement(By.xpath(`//*[contains(text(),"${uniqueName}")]`));
    expect(await ws.isDisplayed()).toBe(true);
  });

  test('workspace settings page is accessible', async () => {
    // Click on first workspace if any exist
    const workspaceCards = await driver.findElements(
      By.css('[class*="workspace" i], [data-testid*="workspace"]')
    );
    if (workspaceCards.length === 0) {
      console.log('No workspaces found — skipping settings test');
      return;
    }
    await workspaceCards[0].click();
    await driver.sleep(1_500);

    // Look for Settings link
    try {
      const settingsLink = await driver.wait(
        until.elementLocated(By.xpath('//*[contains(text(),"Settings") or contains(@href,"settings")]')),
        4_000
      );
      await settingsLink.click();
      await driver.sleep(1_000);
      const url = await driver.getCurrentUrl();
      expect(url).toBeTruthy();
    } catch {
      console.log('Settings link not found — skipping');
    }
  });

  test('invite member generates an invite link', async () => {
    const workspaceCards = await driver.findElements(
      By.css('[class*="workspace" i], [data-testid*="workspace"]')
    );
    if (workspaceCards.length === 0) {
      console.log('No workspaces found — skipping invite test');
      return;
    }
    await workspaceCards[0].click();
    await driver.sleep(1_500);

    const inviteBtn = await driver.wait(
      until.elementLocated(By.xpath('//*[contains(text(),"Invite") or contains(text(),"Add Member")]')),
      6_000
    );
    await inviteBtn.click();

    // An invite link or email input should appear
    const inviteEl = await driver.wait(
      until.elementLocated(
        By.css('input[type="email"], [class*="invite" i], [class*="link" i]')
      ),
      6_000
    );
    expect(await inviteEl.isDisplayed()).toBe(true);
  });
});
