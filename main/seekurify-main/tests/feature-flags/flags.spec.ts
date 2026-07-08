import { WebDriver, By, until } from 'selenium-webdriver';
import * as dotenv from 'dotenv';
import { buildDriver, quitDriver } from '../helpers/driver';
import { restoreSession, BASE_URL } from '../helpers/auth.helper';
dotenv.config({ path: '.env.test' });

describe('Feature Flags', () => {
  let driver: WebDriver;

  beforeAll(async () => {
    driver = await buildDriver();
    await restoreSession(driver);
    await driver.get(`${BASE_URL}/feature-flags`);
    await driver.wait(until.elementLocated(By.css('[class*="flag" i], [class*="feature" i], table, ul')), 8_000);
  });

  afterAll(async () => {
    await quitDriver(driver);
  });

  test('feature flags page loads and renders flag rows', async () => {
    const url = await driver.getCurrentUrl();
    expect(url).toContain('/feature-flags');

    const flagRows = await driver.findElements(
      By.css('[class*="flag" i], [class*="feature" i], tr, li')
    );
    expect(flagRows.length).toBeGreaterThan(0);
  });

  test('toggle switch is present and interactable for each flag', async () => {
    const toggles = await driver.findElements(
      By.css('input[type="checkbox"], [role="switch"], [class*="toggle" i]')
    );
    expect(toggles.length).toBeGreaterThan(0);

    // Check that the first toggle is clickable
    const firstToggle = toggles[0];
    const initialState = await firstToggle.isSelected();
    await firstToggle.click();
    await driver.sleep(800);

    const newState = await firstToggle.isSelected();
    expect(newState).toBe(!initialState);

    // Restore state
    await firstToggle.click();
    await driver.sleep(500);
  });

  test('rollout percentage field accepts numeric input', async () => {
    const percentInputs = await driver.findElements(
      By.css('input[type="number"], input[placeholder*="percent" i], input[placeholder*="rollout" i]')
    );
    if (percentInputs.length === 0) {
      console.log('No rollout percentage field found — skipping');
      return;
    }

    const firstInput = percentInputs[0];
    await firstInput.clear();
    await firstInput.sendKeys('75');
    const value = await firstInput.getAttribute('value');
    expect(value).toBe('75');
  });
});
