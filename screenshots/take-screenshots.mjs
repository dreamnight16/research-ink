import { chromium } from 'playwright';

const SCREENSHOTS_DIR = 'C:\\Users\\DreamNight\\Documents\\01My\\projects\\科研助手\\screenshots';
const APP_URL = 'http://localhost:5173';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const results = [];

  // ============== SCREENSHOT 1: Desktop Home (1280x800) ==============
  console.log('[1/6] desktop-home.png (1280x800) ...');
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: 30000 });
    // Wait for the header and tab bar to render
    await page.waitForSelector('button', { timeout: 15000 });
    await page.waitForTimeout(1000); // let any animations settle
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/desktop-home.png`, fullPage: true });
    console.log('  -> Tab labels found:', await page.locator('nav button').allTextContents());
    results.push('desktop-home.png');
    await context.close();
  }

  // ============== SCREENSHOT 2: Desktop Literature Tab (1280x800) ==============
  console.log('[2/6] desktop-literature.png (1280x800) ...');
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('button', { timeout: 15000 });
    await page.waitForTimeout(500);

    // Find and click the "追新论文" tab
    const buttons = await page.locator('nav button').all();
    let clicked = false;
    for (const btn of buttons) {
      const text = await btn.textContent();
      if (text && text.includes('追新')) {
        await btn.click();
        clicked = true;
        console.log('  -> Clicked tab:', text);
        break;
      }
    }
    if (!clicked) console.log('  -> WARNING: Could not find 追新论文 tab');

    await page.waitForTimeout(800);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/desktop-literature.png`, fullPage: true });
    results.push('desktop-literature.png');
    await context.close();
  }

  // ============== SCREENSHOT 3: Desktop Formula Tab (1280x800) ==============
  console.log('[3/6] desktop-formula.png (1280x800) ...');
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('button', { timeout: 15000 });
    await page.waitForTimeout(500);

    // Click the "验公式" tab
    const buttons = await page.locator('nav button').all();
    for (const btn of buttons) {
      const text = await btn.textContent();
      if (text && text.includes('验公式')) {
        await btn.click();
        console.log('  -> Clicked tab:', text);
        break;
      }
    }

    await page.waitForTimeout(800);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/desktop-formula.png`, fullPage: true });
    results.push('desktop-formula.png');
    await context.close();
  }

  // ============== SCREENSHOT 4: Tablet Home (768x1024) ==============
  console.log('[4/6] tablet-home.png (768x1024) ...');
  {
    const context = await browser.newContext({
      viewport: { width: 768, height: 1024 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('button', { timeout: 15000 });
    await page.waitForTimeout(1000);

    // On tablet, the tab bar may overflow horizontally, check it
    const tabTexts = await page.locator('nav button').allTextContents();
    console.log('  -> Tab labels:', tabTexts);

    await page.screenshot({ path: `${SCREENSHOTS_DIR}/tablet-home.png`, fullPage: true });
    results.push('tablet-home.png');
    await context.close();
  }

  // ============== SCREENSHOT 5: Mobile Home (375x812) ==============
  console.log('[5/6] mobile-home.png (375x812) ...');
  {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      isMobile: true,
      hasTouch: true,
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1',
    });
    const page = await context.newPage();
    await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('button', { timeout: 15000 });
    await page.waitForTimeout(1000);

    const tabTexts = await page.locator('nav button').allTextContents();
    console.log('  -> Tab labels:', tabTexts);

    await page.screenshot({ path: `${SCREENSHOTS_DIR}/mobile-home.png`, fullPage: true });
    results.push('mobile-home.png');
    await context.close();
  }

  // ============== SCREENSHOT 6: Mobile Settings (375x812) ==============
  console.log('[6/6] mobile-settings.png (375x812) ...');
  {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      isMobile: true,
      hasTouch: true,
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1',
    });
    const page = await context.newPage();
    await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('button', { timeout: 15000 });
    await page.waitForTimeout(500);

    // The Settings component is defined but not wired into the visible UI.
    // Try to find anything that says "设置" or looks like a settings button.
    const allButtons = await page.locator('button').all();
    let settingsClicked = false;
    for (const btn of allButtons) {
      const text = await btn.textContent();
      if (text && (text.includes('设置') || text.includes('Settings'))) {
        await btn.click();
        settingsClicked = true;
        console.log('  -> Clicked settings button:', text);
        break;
      }
    }
    if (!settingsClicked) {
      console.log('  -> No settings button found in the UI. Taking current view.');
    }

    await page.waitForTimeout(800);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/mobile-settings.png`, fullPage: true });
    results.push('mobile-settings.png');
    await context.close();
  }

  console.log('\n=== All screenshots taken ===');
  console.log('Files:', results.map((f) => `${SCREENSHOTS_DIR}\\${f}`).join('\n  '));

  await browser.close();
}

main().catch((err) => {
  console.error('Screenshot script failed:', err);
  process.exit(1);
});
