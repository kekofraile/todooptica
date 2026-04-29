const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.addInitScript(() => {
    window.__eyeExplorerForceHighQuality = true;
  });

  await page.goto('http://127.0.0.1:4173/servicios.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => document.querySelectorAll('[data-eye-hotspots] .eye-explorer__hotspot').length > 4,
    { timeout: 20000 },
  );

  const explorer = page.locator('[data-eye-explorer]');
  await explorer.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);
  await page.locator('body').click({ position: { x: 40, y: 40 } });

  const rotateBy = async (steps) => {
    for (let i = 0; i < steps; i += 1) {
      await page.keyboard.press('ArrowRight');
    }
  };

  await page.screenshot({ path: 'output/playwright/eye-explorer-realism-v2-0.png', fullPage: false });

  await rotateBy(15);
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'output/playwright/eye-explorer-realism-v2-90.png', fullPage: false });

  await rotateBy(15);
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'output/playwright/eye-explorer-realism-v2-180.png', fullPage: false });

  await rotateBy(15);
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'output/playwright/eye-explorer-realism-v2-270.png', fullPage: false });

  await browser.close();
})();
