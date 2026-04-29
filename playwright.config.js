// Playwright end-to-end tests for the static site.
// Runs against a local http.server so relative links/assets resolve correctly.

const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests/e2e",
  // Keep Playwright artifacts out of the project root.
  outputDir: ".playwright/test-results",
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:5173",
    browserName: "chromium",
    headless: true,
    viewport: { width: 1280, height: 800 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "python3 -u -m http.server 5173 --bind 127.0.0.1",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
