import fs from "fs";
import { expect, test } from "@playwright/test";

const built = fs.existsSync("dist/lite/index.html");

test("runs the Python-authored Vega dashboard in Pyodide", async ({ page }) => {
  test.skip(!built, "run `make pyodide-example` first");
  test.setTimeout(240_000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto("/dist/lite/index.html");
  await page.waitForFunction(
    () =>
      document.documentElement.dataset.ready === "true" ||
      document.querySelector("#pyodide-status")?.textContent ===
        "Unable to start",
    undefined,
    { timeout: 180_000 },
  );
  await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
  await expect(page.locator(".intro h1")).toHaveText("Vega charts");
  await expect(page.locator("vega-chart")).toHaveCount(3);
  await expect(page.locator("vega-chart[data-rendered='true']")).toHaveCount(3);
  await expect(page.locator("vega-chart svg")).toHaveCount(2);
  await expect(page.locator("vega-chart canvas")).toHaveCount(1);
  const charts = page.locator("vega-chart");
  const initialData = await charts.evaluateAll((elements) =>
    elements.map((element) => JSON.stringify(element.spec.data)),
  );
  await expect
    .poll(() =>
      page
        .locator("#update-count")
        .evaluate((element) => Number(element.textContent)),
    )
    .toBeGreaterThan(0);
  await expect
    .poll(() =>
      charts.evaluateAll((elements) =>
        elements.map((element) => JSON.stringify(element.spec.data)),
      ),
    )
    .not.toEqual(initialData);
  await expect
    .poll(() =>
      page.evaluate(() =>
        Number(document.documentElement.dataset.workerPatches || 0),
      ),
    )
    .toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
