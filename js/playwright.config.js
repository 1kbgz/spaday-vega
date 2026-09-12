import { defineConfig, devices } from "@playwright/test";

const pyodideOnly = process.env.SPADAY_VEGA_PYODIDE_ONLY === "1";

export default defineConfig({
  testDir: "tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ["line"],
    ["html", { outputFile: "playwright-report/index.html", open: "never" }],
    ["junit", { outputFile: "junit.xml" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:3038",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "pnpm run start:tests",
      url: "http://127.0.0.1:3038",
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
    ...(!pyodideOnly
      ? [
          {
            command: "PYTHONPATH=.. python -m spaday_vega.example",
            url: "http://127.0.0.1:8028",
            reuseExistingServer: !process.env.CI,
            timeout: 120 * 1000,
          },
        ]
      : []),
  ],
});
