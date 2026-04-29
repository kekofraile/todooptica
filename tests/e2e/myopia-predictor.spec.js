const { test, expect } = require("@playwright/test");

const AGE_BASE_RATES = {
  6: 0.65,
  7: 0.58,
  8: 0.51,
  9: 0.44,
  10: 0.37,
  11: 0.3,
  12: 0.23,
  13: 0.16,
  14: 0.09,
};

const getAgeBaseRate = (age) => AGE_BASE_RATES[Math.floor(age)] ?? 0.05;

const getSeverityBoost = (myopia) => {
  if (myopia < 1) return 0;
  if (myopia < 2) return 0.05;
  if (myopia < 3) return 0.065;
  if (myopia < 4) return 0.07;
  return 0.075;
};

const projectFinalMyopia = (startAge, startMyopia, factor) => {
  let currentMyopia = startMyopia;
  const severityBoost = getSeverityBoost(startMyopia);

  for (let age = startAge; age < 18; age += 1) {
    currentMyopia += (getAgeBaseRate(age) + severityBoost) * factor;
  }

  return -currentMyopia;
};

const parseSummary = (text) => {
  const match = text.match(
    /A los (\d+) años: sin control (-?\d+\.\d+) D · con control (-?\d+\.\d+) D/,
  );
  if (!match) {
    throw new Error(`No se pudo parsear el resumen: ${text}`);
  }

  return {
    horizonAge: Number(match[1]),
    noControl: Number(match[2]),
    withControl: Number(match[3]),
  };
};

const countPolylinePoints = (points) => points.trim().split(/\s+/).filter(Boolean).length;

test("control de miopia: el predictor actualiza grafica con edad y miopia", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (err) => errors.push(err));

  await page.goto("/control-miopia.html#simulador");

  const predictor = page.locator("[data-myopia-predictor]");
  await expect(predictor).toBeVisible();

  const lineNo = predictor.locator("[data-predictor-line-no-control]");
  const ageInput = predictor.locator("[data-predictor-age]");
  const ageValue = predictor.locator("[data-predictor-age-value]");
  const myopiaRange = page.locator("[data-myopia-range]");
  const myopiaValue = predictor.locator("[data-predictor-myopia]");
  const summary = predictor.locator("[data-predictor-summary]");

  await ageInput.evaluate((el) => {
    el.value = "8";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await expect(ageValue).toHaveText("8 años");

  const pointsAfterAge = await lineNo.getAttribute("points");
  expect(countPolylinePoints(pointsAfterAge)).toBe(11);

  const summaryAfterAge = parseSummary(await summary.textContent());
  expect(summaryAfterAge.horizonAge).toBe(18);
  expect(summaryAfterAge.noControl).toBeCloseTo(projectFinalMyopia(8, 2, 1), 2);
  expect(summaryAfterAge.withControl).toBeCloseTo(
    projectFinalMyopia(8, 2, 0.5),
    2,
  );
  expect(summaryAfterAge.noControl).toBeLessThan(summaryAfterAge.withControl);

  await myopiaRange.evaluate((el) => {
    el.value = "4";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await expect(myopiaValue).toHaveText("-4.00 D");

  const pointsAfterMyopia = await lineNo.getAttribute("points");
  expect(countPolylinePoints(pointsAfterMyopia)).toBe(11);

  const summaryAfterMyopia = parseSummary(await summary.textContent());
  expect(summaryAfterMyopia.horizonAge).toBe(18);
  expect(summaryAfterMyopia.noControl).toBeCloseTo(
    projectFinalMyopia(8, 4, 1),
    2,
  );
  expect(summaryAfterMyopia.withControl).toBeCloseTo(
    projectFinalMyopia(8, 4, 0.5),
    2,
  );
  expect(summaryAfterMyopia.noControl).toBeLessThan(summaryAfterMyopia.withControl);
  expect(summaryAfterMyopia.noControl).toBeLessThan(summaryAfterAge.noControl);

  expect(
    errors.map((e) => e.message || String(e)),
    "No debe haber errores JS en el predictor de miopia.",
  ).toEqual([]);
});
