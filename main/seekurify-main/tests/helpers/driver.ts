import { Builder, WebDriver } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome';
import * as path from 'path';

// Use the chromedriver binary that ships with the npm package.
// Requires the chromedriver version to match your installed Chrome.
// Run `npx chromedriver --version` and `chrome --version` to verify they match.
const chromedriverPath: string = require('chromedriver').path;

export async function buildDriver(headless = false): Promise<WebDriver> {
  const service = new chrome.ServiceBuilder(chromedriverPath);

  const options = new chrome.Options();
  if (headless) {
    options.addArguments('--headless=new');
  }
  options.addArguments(
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--window-size=1280,800',
  );

  return new Builder()
    .forBrowser('chrome')
    .setChromeService(service)
    .setChromeOptions(options)
    .build();
}

export async function quitDriver(driver: WebDriver): Promise<void> {
  // Give quit 5 seconds — if ChromeDriver is stuck after a failed test it will hang indefinitely
  const timeout = new Promise<void>(resolve => setTimeout(resolve, 5_000));
  try {
    await Promise.race([driver.quit(), timeout]);
  } catch {
    // ignore
  }
}
