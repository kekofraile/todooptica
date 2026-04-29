const { test, expect } = require("@playwright/test");

test("blog: la búsqueda filtra tarjetas y actualiza el contador", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (err) => errors.push(err));

  await page.goto("/blog.html");

  const cards = page.locator(".blog-card");
  const total = await cards.count();
  expect(total).toBeGreaterThan(5);

  const countEl = page.locator("#search-count");
  await expect(countEl).toHaveText(new RegExp(`^${total}\\s+artículos$`));

  const search = page.locator("#blog-search");
  await search.fill("glaucoma");

  const visibleAfter = await cards.evaluateAll((els) =>
    els.filter((el) => !el.hidden).length,
  );
  expect(visibleAfter).toBeGreaterThan(0);
  expect(visibleAfter).toBeLessThan(total);
  await expect(countEl).toHaveText(
    new RegExp(`^${visibleAfter}\\s+artículos$`),
  );

  // Todas las tarjetas visibles deben incluir el query (insensible a mayúsculas).
  const allMatch = await cards.evaluateAll((els) => {
    const q = "glaucoma";
    return els
      .filter((el) => !el.hidden)
      .every((el) => (el.textContent || "").toLowerCase().includes(q));
  });
  expect(allMatch).toBe(true);

  // Limpiar vuelve a mostrar todo.
  await search.fill("");
  const visibleFinal = await cards.evaluateAll((els) =>
    els.filter((el) => !el.hidden).length,
  );
  expect(visibleFinal).toBe(total);
  await expect(countEl).toHaveText(new RegExp(`^${total}\\s+artículos$`));

  expect(
    errors.map((e) => e.message || String(e)),
    "No debe haber errores JS durante la búsqueda del blog.",
  ).toEqual([]);
});

