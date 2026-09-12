import { expect, test } from "@playwright/test";

const liteSpec = (values) => ({
  $schema: "https://vega.github.io/schema/vega-lite/v6.json",
  width: 320,
  height: 180,
  data: { values },
  mark: "bar",
  encoding: {
    x: { field: "category", type: "nominal" },
    y: { field: "value", type: "quantitative" },
  },
});

test("renders and reactively updates a Vega-Lite specification", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/dist/index.html");
  await page.waitForFunction(() => customElements.get("vega-chart"));
  await page.evaluate(
    (spec) => {
      globalThis.readyCount = 0;
      const chart = document.createElement("vega-chart");
      chart.addEventListener("vega-ready", () => {
        globalThis.readyCount += 1;
      });
      chart.spec = spec;
      document.body.append(chart);
    },
    liteSpec([{ category: "A", value: 12 }]),
  );

  const chart = page.locator("vega-chart");
  await expect(chart).toHaveAttribute("data-rendered", "true");
  await expect(chart.locator("svg")).toBeVisible();
  await expect.poll(() => page.evaluate(() => globalThis.readyCount)).toBe(1);

  await chart.evaluate(
    (element, spec) => {
      element.spec = spec;
    },
    liteSpec([
      { category: "A", value: 12 },
      { category: "B", value: 21 },
    ]),
  );
  await expect.poll(() => page.evaluate(() => globalThis.readyCount)).toBe(2);
  await expect(chart).toHaveJSProperty("renderer", "svg");
  expect(errors).toEqual([]);
});

test("renders a native Vega specification to canvas", async ({ page }) => {
  await page.goto("/dist/index.html");
  await page.waitForFunction(() => customElements.get("vega-chart"));
  await page.evaluate(() => {
    const chart = document.createElement("vega-chart");
    chart.renderer = "canvas";
    chart.spec = {
      $schema: "https://vega.github.io/schema/vega/v6.json",
      width: 300,
      height: 160,
      data: [{ name: "points", values: [{ x: 40, y: 50 }] }],
      marks: [
        {
          type: "symbol",
          from: { data: "points" },
          encode: {
            enter: {
              x: { field: "x" },
              y: { field: "y" },
              size: { value: 500 },
              fill: { value: "#007ac2" },
            },
          },
        },
      ],
    };
    document.body.append(chart);
  });

  const chart = page.locator("vega-chart");
  await expect(chart).toHaveAttribute("data-rendered", "true");
  await expect(chart.locator("canvas")).toBeVisible();
  await expect(chart).toHaveJSProperty("renderer", "canvas");
});

test("renders the Python-authored dashboard", async ({ page }) => {
  let framesReceived = 0;
  let framesSent = 0;
  page.on("websocket", (socket) => {
    socket.on("framereceived", () => {
      framesReceived += 1;
    });
    socket.on("framesent", () => {
      framesSent += 1;
    });
  });
  await page.goto("http://127.0.0.1:8028");
  await expect(page.locator(".intro h1")).toHaveText("Vega charts");
  await expect(page.locator("vega-chart")).toHaveCount(3);
  await expect(page.locator("vega-chart[data-rendered='true']")).toHaveCount(3);
  await expect(page.locator("vega-chart svg")).toHaveCount(2);
  await expect(page.locator("vega-chart canvas")).toHaveCount(1);
  const charts = page.locator("vega-chart");
  const initialData = await charts.evaluateAll((elements) =>
    elements.map((element) => JSON.stringify(element.spec.data)),
  );
  const initialReceived = framesReceived;
  const initialSent = framesSent;
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
  expect(framesSent).toBeGreaterThan(initialSent);
  expect(framesReceived).toBeGreaterThan(initialReceived);
});

test("keeps the Python dashboard aligned on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("http://127.0.0.1:8028");
  await expect(page.locator(".intro h1")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(1);
});
