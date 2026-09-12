import embed, {
  type EmbedOptions,
  type Result,
  type VisualizationSpec,
} from "vega-embed";

type Spec = VisualizationSpec | string;
type Renderer = "svg" | "canvas";

/** A responsive Vega or Vega-Lite visualization as a custom element. */
export class VegaChart extends HTMLElement {
  private _spec: Spec | null = null;
  private _options: EmbedOptions = {};
  private _renderer: Renderer = "svg";
  private _actions = false;
  private result?: Result;
  private renderId = 0;
  private renderScheduled = false;
  private resizeObserver?: ResizeObserver;

  connectedCallback(): void {
    if (!this.style.display) this.style.display = "block";
    this.resizeObserver = new ResizeObserver(() => {
      void this.result?.view.resize().runAsync();
    });
    this.resizeObserver.observe(this);
    this.scheduleRender();
  }

  disconnectedCallback(): void {
    this.renderId += 1;
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    this.result?.view.finalize();
    this.result = undefined;
  }

  get spec(): Spec | null {
    return this._spec;
  }

  set spec(value: Spec | null) {
    this._spec = value;
    this.scheduleRender();
  }

  get options(): EmbedOptions {
    return this._options;
  }

  set options(value: EmbedOptions | null) {
    this._options = value && typeof value === "object" ? value : {};
    this.scheduleRender();
  }

  get renderer(): Renderer {
    return this._renderer;
  }

  set renderer(value: Renderer) {
    this._renderer = value === "canvas" ? "canvas" : "svg";
    this.scheduleRender();
  }

  get actions(): boolean {
    return this._actions;
  }

  set actions(value: boolean) {
    this._actions = Boolean(value);
    this.scheduleRender();
  }

  get view(): Result["view"] | undefined {
    return this.result?.view;
  }

  private scheduleRender(): void {
    if (!this.isConnected || this.renderScheduled) return;
    this.renderScheduled = true;
    queueMicrotask(() => {
      this.renderScheduled = false;
      void this.render();
    });
  }

  private async render(): Promise<void> {
    const spec = this._spec;
    if (!spec) return;

    const id = ++this.renderId;
    this.result?.view.finalize();
    this.result = undefined;
    delete this.dataset.rendered;
    delete this.dataset.error;

    const container = document.createElement("div");
    container.className = "vega-chart-view";
    this.replaceChildren(container);

    try {
      const result = await embed(container, spec, {
        ...this._options,
        actions: this._actions,
        renderer: this._renderer,
      });
      if (id !== this.renderId || !this.isConnected) {
        result.view.finalize();
        return;
      }
      this.result = result;
      this.dataset.rendered = "true";
      this.dispatchEvent(
        new CustomEvent("vega-ready", { detail: { view: result.view } }),
      );
    } catch (error) {
      if (id !== this.renderId) return;
      const message = error instanceof Error ? error.message : String(error);
      this.dataset.error = message;
      container.className = "vega-chart-error";
      container.textContent = message;
      this.dispatchEvent(
        new CustomEvent("vega-error", { detail: { error, message } }),
      );
    }
  }
}

if (!customElements.get("vega-chart")) {
  customElements.define("vega-chart", VegaChart);
}
