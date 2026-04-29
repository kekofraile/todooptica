const { test, expect } = require("@playwright/test");

test("servicios: muestra tarjetas y explorador del ojo", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (err) => errors.push(err));

  await page.goto("/servicios.html");

  const cards = page.locator("#service-grid .service-card");
  const total = await cards.count();
  expect(total).toBeGreaterThan(0);

  const explorer = page.locator("[data-eye-explorer]");
  await expect(explorer).toBeVisible();
  await expect(explorer.locator("[data-eye-canvas]")).toBeVisible();
  await expect(explorer.locator(".eye-explorer__headline")).toBeVisible();
  await expect(explorer.locator("[data-eye-animate]")).toBeVisible();
  await expect(explorer.locator("[data-eye-progress]")).toContainText("/");

  const parts = explorer.locator("[data-eye-part]");
  const partCount = await parts.count();
  expect(partCount).toBeGreaterThan(4);

  expect(
    errors.map((e) => e.message || String(e)),
    "No debe haber errores JS en la página de servicios.",
  ).toEqual([]);
});
