const { test, expect } = require("@playwright/test");

test.describe("juegos interactivos", () => {
  test("servicios: ojo explorador interactivo", async ({ page }) => {
    test.slow();
    await page.goto("/servicios.html");

    const explorer = page.locator("[data-eye-explorer]");
    await expect(explorer).toBeVisible();
    await expect(explorer.locator("[data-eye-canvas]")).toBeVisible();
    await expect(explorer).toHaveAttribute("data-eye-explorer-mode", "2d");
    await explorer.scrollIntoViewIfNeeded();

    await page.waitForFunction(
      () =>
        Array.from(
          document.querySelectorAll(
            "[data-eye-hotspots] .eye-explorer__hotspot",
          ),
        ).length > 4 &&
        Array.from(
          document.querySelectorAll(
            "[data-eye-hotspots] .eye-explorer__hotspot",
          ),
        ).every((button) => {
          const style = window.getComputedStyle(button);
          return (
            Number.parseFloat(style.left) > 0 &&
            Number.parseFloat(style.top) > 0
          );
        }),
    );

    const nameEl = explorer.locator("[data-eye-part-name]");
    const initialName = await nameEl.textContent();
    const retinaButton = explorer.locator(
      '.eye-part-btn[data-eye-part="retina"]',
    );

    await retinaButton.click();
    await expect(nameEl).not.toHaveText(initialName || "");
    await expect(retinaButton).toHaveClass(/active/);

    await explorer
      .locator("[data-eye-animate]")
      .evaluate((button) => button.click());
    await page.waitForTimeout(300);
    await expect(explorer.locator("[data-eye-angle]")).not.toHaveText("0°");

    await explorer.locator("[data-eye-quiz-toggle]").click();
    const prompt = explorer.locator("[data-eye-quiz-prompt]");
    await expect(prompt).toBeVisible();
    await expect(explorer).toHaveClass(/is-quiz-open/);

    const targetName = (await prompt.textContent()) || "";
    const target = targetName.replace("Encuentra:", "").trim();
    if (target) {
      const targetButton = explorer
        .locator("[data-eye-part]")
        .filter({ hasText: target })
        .first();
      await expect(targetButton).toHaveCount(1);
      await targetButton.click();
    }

    const score = explorer.locator("[data-eye-quiz-score]");
    await expect(score).not.toHaveText("0");
  });

  test("servicios: ojo explorador 3d bajo flag", async ({ page }) => {
    test.slow();
    await page.addInitScript(() => {
      window.__eyeExplorerUse3D = true;
    });

    await page.goto("/servicios.html");
    const explorer = page.locator("[data-eye-explorer]");
    await expect(explorer).toBeVisible();
    await expect(explorer).toHaveAttribute("data-eye-explorer-mode", "3d");
    await explorer.scrollIntoViewIfNeeded();
    await page.waitForFunction(
      () =>
        document.querySelectorAll("[data-eye-hotspots] .eye-explorer__hotspot")
          .length > 4,
    );
  });

  test("servicios: lens lab mejorado", async ({ page }) => {
    test.slow();
    await page.goto("/servicios.html");

    const lab = page.locator("[data-lens-lab]");
    await lab.scrollIntoViewIfNeeded();
    await expect(lab).toBeVisible();
    await expect(lab.locator("[data-lens-canvas]")).toBeVisible();

    await page.waitForFunction(() => {
      const root = document.querySelector("[data-lens-lab]");
      return root && root.dataset.lensScore !== undefined;
    });

    const initialScore = await lab.getAttribute("data-lens-score");
    await lab.locator('[data-lens-feature="ar"]').click();
    await lab.locator('[data-lens-feature="polar"]').click();
    await expect(lab).not.toHaveAttribute("data-lens-score", initialScore);

    await lab.locator("[data-lens-answer]").fill("AAAAA");
    await lab.locator("[data-lens-check]").click({ force: true });
    await page.waitForFunction(() => {
      const feedback = document.querySelector("[data-lens-feedback]");
      return Boolean(
        feedback && feedback.textContent && feedback.textContent.trim().length,
      );
    });

    await lab
      .locator("[data-lens-hint-btn]")
      .evaluate((button) => button.click());
    await page.waitForFunction(() => {
      const hint = document.querySelector("[data-lens-hint]");
      return Boolean(
        hint && hint.textContent && hint.textContent.trim().length,
      );
    });
  });

  test("tecnologia: desafio de enfoque", async ({ page }) => {
    await page.addInitScript(() => {
      window.__focusGameTestDuration = 3;
    });

    await page.goto("/tecnologia.html");
    await page.locator("#desafio-enfoque").scrollIntoViewIfNeeded();
    const target = page.locator("[data-game-target]");
    await expect(target).toBeVisible();
    await page.waitForFunction(() => Boolean(window.__focusGame));

    await page.evaluate(() => {
      window.__focusGame?.start();
      window.__focusGame?.setBlur(1);
    });
    await page.evaluate(() => {
      window.__focusGame?.setBlur(0);
      window.__focusGame?.capture();
    });
    await expect(page.locator("[data-game-streak]")).not.toHaveText("0");

    await page.locator("[data-game-mode]").selectOption("timed");
    await page.locator("[data-game-trigger]").click();
    await expect(page.locator("[data-game-timer]")).not.toHaveText("∞");
    await expect(page.locator("[data-game-feedback]")).not.toHaveText("");
  });
});
