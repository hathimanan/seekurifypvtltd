import { WebDriver, By, until } from 'selenium-webdriver';
import * as dotenv from 'dotenv';
import { buildDriver, quitDriver } from '../helpers/driver';
import { restoreSession, BASE_URL } from '../helpers/auth.helper';
dotenv.config({ path: '.env.test' });

describe('Vault — Breach Detection & Risk Scoring', () => {
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

  test('"Check Breaches" button is present on the dashboard', async () => {
    const breachBtn = await driver.wait(
      until.elementLocated(
        By.xpath('//*[contains(text(),"Breach") or contains(text(),"breach") or contains(@aria-label,"breach" )]')
      ),
      8_000
    );
    expect(await breachBtn.isDisplayed()).toBe(true);
  });

  test('clicking "Check Breaches" triggers breach scan and shows results', async () => {
    const breachBtn = await driver.wait(
      until.elementLocated(
        By.xpath('//*[contains(text(),"Check Breach") or contains(text(),"Breach Check")]')
      ),
      8_000
    );
    await breachBtn.click();

    // Wait for results — a loading state followed by result badges / text
    await driver.wait(
      until.elementLocated(
        By.xpath('//*[contains(@class,"breach") or contains(@class,"Breach") or contains(text(),"breached") or contains(text(),"Safe")]')
      ),
      20_000
    );
    const resultEl = await driver.findElement(
      By.xpath('//*[contains(@class,"breach") or contains(@class,"Breach") or contains(text(),"breached") or contains(text(),"Safe")]')
    );
    expect(await resultEl.isDisplayed()).toBe(true);
  });

  test('"Run Risk Score" button is present', async () => {
    const riskBtn = await driver.wait(
      until.elementLocated(
        By.xpath('//*[contains(text(),"Risk") or contains(text(),"risk") or contains(@aria-label,"risk")]')
      ),
      8_000
    );
    expect(await riskBtn.isDisplayed()).toBe(true);
  });

  test('clicking "Run Risk Score" shows risk badges on entries', async () => {
    const riskBtn = await driver.wait(
      until.elementLocated(
        By.xpath('//*[contains(text(),"Score") or contains(text(),"Risk Score") or contains(@aria-label,"score")]')
      ),
      8_000
    );
    await riskBtn.click();

    // Wait for risk level badge — critical / high / medium / low
    await driver.wait(
      until.elementLocated(
        By.xpath('//*[contains(@class,"risk") or contains(@class,"Risk") or contains(text(),"Critical") or contains(text(),"High") or contains(text(),"Medium") or contains(text(),"Low")]')
      ),
      25_000
    );
    const badge = await driver.findElement(
      By.xpath('//*[contains(@class,"risk") or contains(@class,"Risk") or contains(text(),"Critical") or contains(text(),"High") or contains(text(),"Medium") or contains(text(),"Low")]')
    );
    expect(await badge.isDisplayed()).toBe(true);
  });
});
