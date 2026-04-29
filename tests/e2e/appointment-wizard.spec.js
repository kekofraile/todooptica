const { test, expect } = require("@playwright/test");

const collectPageErrors = (page) => {
  const errors = [];
  page.on("pageerror", (err) => errors.push(err));
  return errors;
};

const chooseRadio = async (page, name, value) => {
  const updated = await page.evaluate(
    ({ radioName, radioValue }) => {
      const input = document.querySelector(
        `input[name="${radioName}"][value="${radioValue}"]`,
      );
      if (!(input instanceof HTMLInputElement)) return false;
      input.checked = true;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    },
    { radioName: name, radioValue: value },
  );

  expect(updated, `No se encontró el radio ${name}=${value}.`).toBeTruthy();
};

const waitForFlatpickr = async (page) => {
  await page.waitForFunction(() => {
    const input = document.querySelector('input[name="date"]');
    return Boolean(input && input._flatpickr);
  });
};

const setWizardDate = async (page, isoDate) => {
  await page.evaluate((dateValue) => {
    const input = document.querySelector('input[name="date"]');
    if (input && input._flatpickr) {
      input._flatpickr.setDate(dateValue, true);
    } else if (input) {
      input.value = dateValue;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }, isoDate);
};

const forceWizardDateValue = async (page, isoDate) => {
  await page.evaluate((dateValue) => {
    const input = document.querySelector('input[name="date"]');
    if (!input) return;
    input.value = dateValue;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, isoDate);
};

const formatIsoDate = (isoDate) => {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
};

const getNextAvailableDate = async (page) =>
  page.evaluate(() => {
    const input = document.querySelector('input[name="date"]');
    const fp = input && input._flatpickr;
    if (!fp) return null;

    const disabled = Array.isArray(fp.config.disable) ? fp.config.disable : [];
    const isDisabled = (candidate) =>
      disabled.some((entry) => {
        if (typeof entry === "function") return Boolean(entry(candidate));
        if (typeof entry === "string") {
          const parsed = fp.parseDate(entry, "Y-m-d");
          return Boolean(parsed && parsed.toDateString() === candidate.toDateString());
        }
        return false;
      });

    const candidate = new Date();
    candidate.setHours(12, 0, 0, 0);

    for (let offset = 1; offset <= 60; offset += 1) {
      const next = new Date(candidate);
      next.setDate(candidate.getDate() + offset);
      if (!isDisabled(next)) {
        return fp.formatDate(next, "Y-m-d");
      }
    }

    return null;
  });

const getNextSunday = async (page) =>
  page.evaluate(() => {
    const input = document.querySelector('input[name="date"]');
    const fp = input && input._flatpickr;
    if (!fp) return null;

    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const sunday = new Date(today);
    const offset = (7 - sunday.getDay()) % 7 || 7;
    sunday.setDate(sunday.getDate() + offset);
    return fp.formatDate(sunday, "Y-m-d");
  });

test("cita: el wizard avanza y muestra el resumen", async ({ page }) => {
  const errors = collectPageErrors(page);

  await page.goto("/cita.html");

  const step0 = page.locator('.wizard-slide[data-slide="0"]');
  const step1 = page.locator('.wizard-slide[data-slide="1"]');
  const step2 = page.locator('.wizard-slide[data-slide="2"]');
  const step3 = page.locator('.wizard-slide[data-slide="3"]');

  await expect(step0).toHaveClass(/active/);
  await expect(step1).not.toHaveClass(/active/);
  await expect(step2).not.toHaveClass(/active/);
  await expect(step3).not.toHaveClass(/active/);

  await chooseRadio(page, "location", "labradores");
  await expect(step1).toHaveClass(/active/);

  const asideActions = page.locator("[data-aside-actions]");
  await expect(asideActions).toBeVisible();
  await expect(page.locator("[data-aside-center]")).toContainText("Labradores");
  await expect(page.locator("[data-aside-tel]")).toHaveAttribute(
    "href",
    /\+34983397231/,
  );
  await expect(page.locator("[data-aside-whatsapp]")).toHaveAttribute(
    "href",
    /wa\.me\/34601045111/i,
  );

  await chooseRadio(page, "service", "Salud visual");
  await expect(step2).toHaveClass(/active/);

  const time = page.locator('select[name="time"]');

  await waitForFlatpickr(page);
  const selectedDate = await getNextAvailableDate(page);
  expect(selectedDate, "Debe existir una fecha disponible en el calendario.").toBeTruthy();
  await setWizardDate(page, selectedDate);

  await page.waitForFunction(() => {
    const select = document.querySelector('select[name="time"]');
    return select && Array.from(select.options).some((opt) => opt.value);
  });

  const selectedTime = await time.evaluate((select) => {
    const option = Array.from(select.options).find(
      (opt) => opt.value && !opt.disabled,
    );
    return option ? option.value : "";
  });
  expect(selectedTime, "Debe existir una franja horaria disponible.").toBeTruthy();
  await time.selectOption(selectedTime);
  await expect(time).toHaveValue(selectedTime);
  await page.locator("[data-wizard-next]").click();

  await expect(step3).toHaveClass(/active/);
  await expect(page.locator("[data-summary-location]")).toContainText(
    "Labradores",
  );
  await expect(page.locator("[data-summary-service]")).toContainText(
    "Salud visual",
  );
  await expect(page.locator("[data-summary-date]")).toContainText(
    formatIsoDate(selectedDate),
  );
  await expect(page.locator("[data-summary-time]")).toContainText(selectedTime);

  // Volver permite editar.
  await step3.locator("[data-wizard-prev]").click();
  await expect(step2).toHaveClass(/active/);

  expect(
    errors.map((e) => e.message || String(e)),
    "No debe haber errores JS durante el flujo del wizard.",
  ).toEqual([]);
});

test("cita: Valladolid bloquea festivos y domingos", async ({ page }) => {
  const errors = collectPageErrors(page);

  await page.goto("/cita.html");

  await chooseRadio(page, "location", "labradores");
  await chooseRadio(page, "service", "Salud visual");

  const step2 = page.locator('.wizard-slide[data-slide="2"]');
  await expect(step2).toHaveClass(/active/);

  const time = page.locator('select[name="time"]');

  await waitForFlatpickr(page);
  const blockedDate = await getNextSunday(page);
  expect(blockedDate, "Debe existir al menos un domingo futuro bloqueado.").toBeTruthy();
  await forceWizardDateValue(page, blockedDate);
  await expect(time).toContainText(/Festivo|no disponible/i);
  await page.locator("[data-wizard-next]").click();

  await expect(step2).toHaveClass(/active/);

  expect(
    errors.map((e) => e.message || String(e)),
    "No debe haber errores JS durante la validación de festivos.",
  ).toEqual([]);
});
