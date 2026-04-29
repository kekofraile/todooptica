const { test, expect } = require("@playwright/test");

test("control de miopia: el simulador actualiza dioptrias y toggle", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (err) => errors.push(err));

  await page.goto("/control-miopia.html#simulador");

  const value = page.locator("[data-myopia-value]");
  const range = page.locator("[data-myopia-range]");
  const toggle = page.locator("[data-myopia-toggle]");

  await expect(range).toBeVisible();
  await expect(value).toHaveText("-2.00 D");

  // Cambia el slider (range) de forma fiable (input event).
  await range.evaluate((el) => {
    el.value = "4";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await expect(value).toHaveText("-4.00 D");

  await toggle.click();
  await expect(toggle).toHaveText("Volver a sin corrección");

  await toggle.click();
  await expect(toggle).toHaveText("Ver con corrección");

  expect(
    errors.map((e) => e.message || String(e)),
    "No debe haber errores JS en el simulador.",
  ).toEqual([]);
});
