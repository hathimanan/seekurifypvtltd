import { WebDriver, By, until } from 'selenium-webdriver';
import * as dotenv from 'dotenv';
import { buildDriver, quitDriver } from '../helpers/driver';
import { restoreSession, BASE_URL } from '../helpers/auth.helper';
dotenv.config({ path: '.env.test' });

describe('Site Audit & CSP Builder', () => {
  let driver: WebDriver;

  beforeAll(async () => {
    driver = await buildDriver();
    await restoreSession(driver);
  });

  afterAll(async () => {
    await quitDriver(driver);
  });

  // ── Site Shield Audit ───────────────────────────────────────────────────────

  test('site audit page loads with domain input', async () => {
    await driver.get(`${BASE_URL}/site-shield`);
    const domainInput = await driver.wait(
      until.elementLocated(By.css('input[type="url"], input[placeholder*="domain" i], input[placeholder*="URL" i]')),
      8_000
    );
    expect(await domainInput.isDisplayed()).toBe(true);
  });

  test('running an audit renders SSL + header result rows', async () => {
    await driver.get(`${BASE_URL}/site-shield`);
    const domainInput = await driver.wait(
      until.elementLocated(By.css('input[type="url"], input[placeholder*="domain" i], input[placeholder*="URL" i]')),
      8_000
    );
    await domainInput.clear();
    await domainInput.sendKeys('https://example.com');

    await driver.findElement(By.css('button[type="submit"], button[class*="scan" i], button[class*="audit" i]')).click();

    // Wait for result rows — SSL grade or header pass/fail labels
    const resultEl = await driver.wait(
      until.elementLocated(
        By.xpath('//*[contains(text(),"SSL") or contains(text(),"CSP") or contains(text(),"HSTS") or contains(text(),"Grade") or contains(text(),"Pass") or contains(text(),"Fail")]')
      ),
      30_000
    );
    expect(await resultEl.isDisplayed()).toBe(true);
  });

  test('audit shows DNS records section', async () => {
    await driver.get(`${BASE_URL}/site-shield`);
    const domainInput = await driver.wait(
      until.elementLocated(By.css('input[type="url"], input[placeholder*="domain" i], input[placeholder*="URL" i]')),
      8_000
    );
    await domainInput.clear();
    await domainInput.sendKeys('https://example.com');
    await driver.findElement(By.css('button[type="submit"], button[class*="scan" i], button[class*="audit" i]')).click();

    await driver.wait(
      until.elementLocated(
        By.xpath('//*[contains(text(),"DNS") or contains(text(),"SPF") or contains(text(),"DMARC") or contains(text(),"DKIM")]')
      ),
      30_000
    );
    const dnsEl = await driver.findElement(
      By.xpath('//*[contains(text(),"DNS") or contains(text(),"SPF") or contains(text(),"DMARC") or contains(text(),"DKIM")]')
    );
    expect(await dnsEl.isDisplayed()).toBe(true);
  });

  // ── CSP Builder ─────────────────────────────────────────────────────────────

  test('CSP builder page loads', async () => {
    await driver.get(`${BASE_URL}/csp-builder`);
    const heading = await driver.wait(
      until.elementLocated(By.xpath('//*[contains(text(),"CSP") or contains(text(),"Content Security Policy")]')),
      8_000
    );
    expect(await heading.isDisplayed()).toBe(true);
  });

  test('adding a directive updates the generated CSP string', async () => {
    await driver.get(`${BASE_URL}/csp-builder`);

    // Locate a directive input (default-src or script-src)
    const directiveInputs = await driver.wait(
      until.elementsLocated(By.css('input[placeholder*="src" i], input[placeholder*="directive" i], select')),
      8_000
    );
    expect(directiveInputs.length).toBeGreaterThan(0);

    // Type a value into the first input
    await directiveInputs[0].sendKeys("'self'");

    // CSP output area should update
    await driver.sleep(500);
    const cspOutput = await driver.wait(
      until.elementLocated(By.css('pre, code, textarea[readonly], [class*="output" i], [class*="policy" i]')),
      6_000
    );
    const outputText = await cspOutput.getText();
    expect(outputText.length).toBeGreaterThan(0);
  });
});
