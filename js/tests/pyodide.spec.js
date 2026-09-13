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
    elements.map((element) => JSON.stringify(element.data)),
  );
  await charts.evaluateAll((elements) => {
    globalThis.initialViews = elements.map((element) => element.view);
  });
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
        elements.map((element) => JSON.stringify(element.data)),
      ),
    )
    .not.toEqual(initialData);
  expect(
    await charts.evaluateAll((elements) =>
      elements.every(
        (element, index) => element.view === globalThis.initialViews[index],
      ),
    ),
  ).toBe(true);
  const initialPatches = await page.evaluate(() =>
    Number(document.documentElement.dataset.workerPatches || 0),
  );
  await charts.first().evaluate(async (element) => {
    await element.view.signal("hovered", "10:00").runAsync();
  });
  await expect(page.locator("#hovered-point")).toHaveText("10:00");
  await expect
    .poll(() =>
      page.evaluate(() =>
        Number(document.documentElement.dataset.workerPatches || 0),
      ),
    )
    .toBeGreaterThan(initialPatches);
  expect(errors).toEqual([]);
});

test("keeps the scroll position when Pyodide updates chart data", async ({
  page,
}) => {
  test.skip(!built, "run `make pyodide-example` first");
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 800, height: 500 });
  await page.goto("/dist/lite/index.html");
  await page.waitForFunction(
    () => document.documentElement.dataset.ready === "true",
    undefined,
    { timeout: 180_000 },
  );
  await expect(page.locator("vega-chart[data-rendered='true']")).toHaveCount(3);

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const initialScroll = await page.evaluate(() => window.scrollY);
  const initialData = await page
    .locator("vega-chart")
    .evaluateAll((elements) =>
      elements.map((element) => JSON.stringify(element.data)),
    );
  await page.evaluate(() => {
    globalThis.minimumScrollY = window.scrollY;
    window.addEventListener("scroll", () => {
      globalThis.minimumScrollY = Math.min(
        globalThis.minimumScrollY,
        window.scrollY,
      );
    });
  });

  await expect
    .poll(() =>
      page
        .locator("vega-chart")
        .evaluateAll((elements) =>
          elements.map((element) => JSON.stringify(element.data)),
        ),
    )
    .not.toEqual(initialData);
  await expect(page.locator("vega-chart[data-rendered='true']")).toHaveCount(3);

  expect(await page.evaluate(() => window.scrollY)).toBeCloseTo(
    initialScroll,
    0,
  );
  expect(await page.evaluate(() => globalThis.minimumScrollY)).toBeCloseTo(
    initialScroll,
    0,
  );
});
