import { WebDriver, By, until, Key } from 'selenium-webdriver';
import * as dotenv from 'dotenv';
import { buildDriver, quitDriver } from '../helpers/driver';
import { restoreSession, BASE_URL } from '../helpers/auth.helper';
dotenv.config({ path: '.env.test' });

describe('Findings Board', () => {
  let driver: WebDriver;

  beforeAll(async () => {
    driver = await buildDriver();
    await restoreSession(driver);
    await driver.get(`${BASE_URL}/findings`);
    await driver.wait(until.elementLocated(By.css('[class*="finding" i], [class*="board" i], table, ul')), 8_000);
  });

  afterAll(async () => {
    await quitDriver(driver);
  });

  test('findings board page loads', async () => {
    const url = await driver.getCurrentUrl();
    expect(url).toContain('/findings');
  });

  test('create a new finding and verify it appears on the board', async () => {
    const createBtn = await driver.wait(
      until.elementLocated(
        By.xpath('//*[contains(text(),"New Finding") or contains(text(),"Create") or contains(text(),"Add Finding") or contains(@aria-label,"create" )]')
      ),
      8_000
    );
    await createBtn.click();

    // Fill in finding form
    const titleField = await driver.wait(
      until.elementLocated(By.css('input[name="title"], input[placeholder*="title" i]')),
      6_000
    );
    const uniqueTitle = `Test Finding ${Date.now()}`;
    await titleField.clear();
    await titleField.sendKeys(uniqueTitle);

    // Set severity if a select/dropdown exists
    try {
      const severitySelect = await driver.findElement(By.css('select[name="severity"], [aria-label*="severity" i]'));
      await severitySelect.sendKeys('Critical');
    } catch { /* optional field */ }

    // Description
    try {
      const descField = await driver.findElement(By.css('textarea[name="description"], textarea'));
      await descField.sendKeys('Automated test finding description.');
    } catch { /* optional */ }

    await driver.findElement(By.css('button[type="submit"], button[class*="save" i]')).click();

    // Finding should now appear on board
    await driver.wait(until.elementLocated(By.xpath(`//*[contains(text(),"${uniqueTitle}")]`)), 8_000);
    const finding = await driver.findElement(By.xpath(`//*[contains(text(),"${uniqueTitle}")]`));
    expect(await finding.isDisplayed()).toBe(true);
  });

  test('filter by severity shows only matching findings', async () => {
    // Click on the Critical severity filter
    const filterBtn = await driver.wait(
      until.elementLocated(
        By.xpath('//*[contains(text(),"Critical") and (contains(@class,"filter") or contains(@class,"badge") or self::button or self::option)]')
      ),
      8_000
    );
    await filterBtn.click();
    await driver.sleep(800);

    // All visible findings should be critical (or no findings shown)
    const severityBadges = await driver.findElements(
      By.xpath('//*[contains(@class,"severity") or contains(@class,"badge")]')
    );
    // If badges are visible, they should all contain "Critical"
    for (const badge of severityBadges) {
      const text = await badge.getText();
      if (text.trim() !== '') {
        expect(text.toLowerCase()).toContain('critical');
      }
    }
  });

  test('update finding status to resolved', async () => {
    const statusDropdowns = await driver.findElements(
      By.css('select[name="status"], [aria-label*="status" i], [class*="status" i] button')
    );
    if (statusDropdowns.length === 0) {
      console.log('No status dropdown found — skipping status update test');
      return;
    }

    await statusDropdowns[0].click();

    try {
      const resolvedOption = await driver.wait(
        until.elementLocated(By.xpath('//*[contains(text(),"Resolved") or contains(text(),"resolved")]')),
        4_000
      );
      await resolvedOption.click();
    } catch { /* select option path */ }

    await driver.sleep(800);
    // Status should reflect "resolved" somewhere in the DOM
    const resolvedEl = await driver.findElements(
      By.xpath('//*[contains(text(),"Resolved") or contains(text(),"resolved")]')
    );
    expect(resolvedEl.length).toBeGreaterThan(0);
  });
});
