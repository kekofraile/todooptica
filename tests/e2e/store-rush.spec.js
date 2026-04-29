const { test, expect } = require("@playwright/test");

test.describe("Lumen Optical: Store Rush", () => {
  test("landing links into the playable game", async ({ page }) => {
    await page.goto("/simulador-optica.html");
    await expect(page.locator("h1")).toHaveText(/Lumen Optical: Store Rush/);
    await page.locator('a[href="games/lumen-optical-store-rush/"]').first().click();
    await expect(page).toHaveURL(/\/games\/lumen-optical-store-rush\/$/);
    await expect(page.locator("text=Lumen Optical: Store Rush")).toBeVisible();
  });

  test("campaign flow boots, requires cashier hire, and resumes after buying the upgrade", async ({
    page,
  }) => {
    test.slow();
    await page.goto("/games/lumen-optical-store-rush/");
    await expect(page.locator('button[data-action="new"]')).toBeVisible();

    await page.locator('button[data-action="new"]').click();
    await expect(page.locator('[data-briefing-title]')).toContainText("Día 1");
    await page.locator('button[data-action="start-day"]').click();
    await expect(page.locator("[data-hud]")).toBeVisible();
    await expect(page.locator("[data-objective]")).toContainText("Objetivo:");

    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      window.__lumenStoreRush.finishDay();
    });
    await expect(page.locator("[data-results]")).toBeVisible();
    await page.locator('button[data-action="next-day"]').click();
    await expect(page.locator("[data-upgrades]")).toBeVisible();
    await expect(page.locator("text=Contrata a la cajera de apoyo")).toBeVisible();

    await page.evaluate(() => {
      const ctrl = window.__lumenStoreRush.controller;
      ctrl.sim.save.totalCash = 300;
      ctrl.ui.showUpgrades(ctrl.sim);
    });
    await page.locator('[data-upgrade-id="ops_fast_checkout"]').click();
    await expect(page.locator('[data-upgrade-id="ops_fast_checkout"]')).toHaveCount(0);
    await expect(page.locator('button[data-action="resume-campaign"]')).toBeEnabled();
    await page.locator('button[data-action="resume-campaign"]').click();
    await expect(page.locator("[data-hud]")).toBeVisible();

    const resumedPage = await page.context().newPage();
    await resumedPage.goto("/games/lumen-optical-store-rush/");
    await expect(resumedPage.locator('button[data-action="continue"]')).toBeEnabled();
    await resumedPage.locator('button[data-action="continue"]').click();
    await expect(resumedPage.locator("[data-briefing-title]")).toContainText("Día 2");
  });
});
