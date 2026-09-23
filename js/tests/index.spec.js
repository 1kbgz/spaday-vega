import { expect, test } from "@playwright/test";

const liteSpec = () => ({
  $schema: "https://vega.github.io/schema/vega-lite/v6.json",
  width: 320,
  height: 180,
  data: { name: "values" },
  datasets: { values: [] },
  mark: "bar",
  encoding: {
    x: { field: "category", type: "nominal" },
    y: { field: "value", type: "quantitative" },
  },
});

test("updates named Vega-Lite data without replacing the view", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/dist/index.html");
  await page.waitForFunction(() => customElements.get("vega-chart"));
  await page.evaluate((spec) => {
    globalThis.readyCount = 0;
    globalThis.updateCount = 0;
    const chart = document.createElement("vega-chart");
    chart.addEventListener("vega-ready", () => {
      globalThis.readyCount += 1;
    });
    chart.addEventListener("vega-update", () => {
      globalThis.updateCount += 1;
    });
    chart.spec = spec;
    chart.data = { values: [{ category: "A", value: 12 }] };
    document.body.append(chart);
  }, liteSpec());

  const chart = page.locator("vega-chart");
  await expect(chart).toHaveAttribute("data-rendered", "true");
  await expect(chart.locator("svg")).toBeVisible();
  await expect.poll(() => page.evaluate(() => globalThis.readyCount)).toBe(1);
  await chart.evaluate((element) => {
    globalThis.initialView = element.view;
  });
  const initialUpdateCount = await page.evaluate(() => globalThis.updateCount);

  await chart.evaluate((element) => {
    element.data = {
      values: [
        { category: "A", value: 12 },
        { category: "B", value: 21 },
      ],
    };
  });
  await expect
    .poll(() => page.evaluate(() => globalThis.updateCount))
    .toBeGreaterThan(initialUpdateCount);
  await expect
    .poll(() => chart.evaluate((element) => element.view.data("values").length))
    .toBe(2);
  expect(
    await chart.evaluate((element) => element.view === globalThis.initialView),
  ).toBe(true);
  await expect.poll(() => page.evaluate(() => globalThis.readyCount)).toBe(1);
  await expect(chart).toHaveJSProperty("renderer", "svg");
  expect(errors).toEqual([]);
});

test("updates and emits named Vega signals", async ({ page }) => {
  await page.goto("/dist/index.html");
  await page.waitForFunction(() => customElements.get("vega-chart"));
  await page.evaluate(() => {
    globalThis.readyCount = 0;
    globalThis.signalEvents = [];
    const chart = document.createElement("vega-chart");
    chart.spec = {
      $schema: "https://vega.github.io/schema/vega/v6.json",
      width: 100,
      height: 100,
      signals: [
        { name: "threshold", value: 0 },
        { name: "selected", value: "None" },
      ],
      marks: [],
    };
    chart.signals = { threshold: 12 };
    chart.signal_listeners = ["selected"];
    chart.addEventListener("vega-ready", () => {
      globalThis.readyCount += 1;
    });
    chart.addEventListener("vega-signal", (event) => {
      globalThis.signalEvents.push(event.detail);
    });
    document.body.append(chart);
  });

  const chart = page.locator("vega-chart");
  await expect(chart).toHaveAttribute("data-rendered", "true");
  await expect.poll(() => page.evaluate(() => globalThis.readyCount)).toBe(1);
  await chart.evaluate((element) => {
    globalThis.initialView = element.view;
    element.signals = { threshold: 18 };
  });
  await expect
    .poll(() => chart.evaluate((element) => element.view.signal("threshold")))
    .toBe(18);
  expect(
    await chart.evaluate((element) => element.view === globalThis.initialView),
  ).toBe(true);

  await chart.evaluate(async (element) => {
    await element.view.signal("selected", "A").runAsync();
  });
  await expect
    .poll(() => page.evaluate(() => globalThis.signalEvents))
    .toEqual([{ name: "selected", value: "A" }]);

  await chart.evaluate((element) => {
    element.renderer = "canvas";
  });
  await expect.poll(() => page.evaluate(() => globalThis.readyCount)).toBe(2);
  await expect(chart.locator("canvas")).toBeVisible();
  await expect
    .poll(() => chart.evaluate((element) => element.view.signal("threshold")))
    .toBe(18);
  await chart.evaluate(async (element) => {
    await element.view.signal("selected", "B").runAsync();
  });
  await expect
    .poll(() => page.evaluate(() => globalThis.signalEvents))
    .toEqual([
      { name: "selected", value: "A" },
      { name: "selected", value: "B" },
    ]);
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
      data: [{ name: "points" }],
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
    chart.data = { points: [{ x: 40, y: 50 }] };
    document.body.append(chart);
  });

  const chart = page.locator("vega-chart");
  await expect(chart).toHaveAttribute("data-rendered", "true");
  await expect(chart.locator("canvas")).toBeVisible();
  await expect(chart).toHaveJSProperty("renderer", "canvas");
});

test("chart defaults follow shell and package color tokens", async ({
  page,
}) => {
  await page.goto("/dist/index.html");
  await page.waitForFunction(() => customElements.get("vega-chart"));
  await page.evaluate((spec) => {
    const host = document.createElement("div");
    host.style.setProperty("--spa-surface", "rgb(1, 2, 3)");
    host.style.setProperty("--spa-muted", "rgb(4, 5, 6)");
    host.style.setProperty("--spa-border", "rgb(7, 8, 9)");
    host.style.setProperty("--spa-accent", "rgb(10, 11, 12)");
    host.style.setProperty("--spa-vega-mark", "rgb(13, 14, 15)");
    const chart = document.createElement("vega-chart");
    chart.spec = spec;
    chart.data = { values: [{ category: "A", value: 12 }] };
    host.appendChild(chart);
    document.body.appendChild(host);
  }, liteSpec());

  const chart = page.locator("vega-chart");
  await expect(chart).toHaveAttribute("data-rendered", "true");
  const svg = await chart.evaluate((element) => element.view.toSVG());
  expect(svg).toContain("rgb(1, 2, 3)");
  expect(svg).toContain("rgb(4, 5, 6)");
  expect(svg).toContain("rgb(7, 8, 9)");
  expect(svg).toContain("rgb(13, 14, 15)");
});

test("an explicit Vega-Lite mark color outranks the package token", async ({
  page,
}) => {
  await page.goto("/dist/index.html");
  await page.waitForFunction(() => customElements.get("vega-chart"));
  await page.evaluate((spec) => {
    const chart = document.createElement("vega-chart");
    chart.style.setProperty("--spa-vega-mark", "rgb(13, 14, 15)");
    chart.spec = {
      ...spec,
      mark: { type: "bar", color: "rgb(90, 91, 92)" },
    };
    chart.data = { values: [{ category: "A", value: 12 }] };
    document.body.appendChild(chart);
  }, liteSpec());

  const chart = page.locator("vega-chart");
  await expect(chart).toHaveAttribute("data-rendered", "true");
  expect(await chart.evaluate((element) => element.view.toSVG())).toContain(
    "rgb(90, 91, 92)",
  );
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
  await expect
    .poll(() =>
      charts.evaluateAll((elements) =>
        elements.every((element) => element.data.values.length > 0),
      ),
    )
    .toBe(true);
  const initialData = await charts.evaluateAll((elements) =>
    elements.map((element) => JSON.stringify(element.data)),
  );
  const initialUpdate = await page
    .locator("#update-count")
    .evaluate((element) => Number(element.textContent));
  const initialReceived = framesReceived;
  const initialSent = framesSent;
  await page.locator(".transport-clock").evaluate((element, elapsedTime) => {
    element.style.animation = "none";
    element.dispatchEvent(
      new AnimationEvent("animationiteration", { elapsedTime }),
    );
  }, initialUpdate + 10);
  await expect
    .poll(() =>
      page
        .locator("#update-count")
        .evaluate((element) => Number(element.textContent)),
    )
    .toBeGreaterThan(initialUpdate);
  await expect.poll(() => framesSent).toBeGreaterThan(initialSent);
  await expect.poll(() => framesReceived).toBeGreaterThan(initialReceived);
  await expect
    .poll(() =>
      charts.evaluateAll((elements) =>
        elements.map((element) => JSON.stringify(element.data)),
      ),
    )
    .not.toEqual(initialData);
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

test("keeps the scroll position when chart data updates", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 500 });
  await page.goto("http://127.0.0.1:8028");
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
