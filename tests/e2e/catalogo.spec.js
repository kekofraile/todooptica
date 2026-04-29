const { test, expect } = require("@playwright/test");

test("catalogo: filtros, contador y CTA de cita funcionan", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (err) => errors.push(err));

  await page.goto("/catalogo.html");

  const count = page.locator("[data-catalog-count]");
  const visibleItems = page.locator("[data-catalog-item]:not([hidden])");

  await expect(visibleItems).toHaveCount(8);
  await expect(count).toContainText("8 monturas/colecciones");

  await page.locator('[data-filter="premium"]').click();
  await expect(page.locator('[data-filter="premium"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(visibleItems).toHaveCount(2);
  await expect(count).toContainText("2 monturas/colecciones");

  await page.locator('[data-filter="kids"]').click();
  await expect(page.locator('[data-filter="kids"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(visibleItems).toHaveCount(2);
  await expect(count).toContainText("2 monturas/colecciones");

  await page.locator('[data-filter="all"]').click();
  await expect(page.locator('[data-filter="all"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(visibleItems).toHaveCount(8);
  await expect(count).toContainText("8 monturas/colecciones");

  const bookingCta = page
    .locator('a.btn.primary[href*="cita.html?service=Gafas%20graduadas"]')
    .first();
  await expect(bookingCta).toBeVisible();
  await expect(bookingCta).toHaveAttribute(
    "href",
    /cita\.html\?service=Gafas%20graduadas/,
  );

  expect(
    errors.map((e) => e.message || String(e)),
    "No debe haber errores JS durante el flujo del catálogo.",
  ).toEqual([]);
});
