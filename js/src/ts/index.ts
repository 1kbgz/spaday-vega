import embed, {
  type EmbedOptions,
  type Result,
  type VisualizationSpec,
} from "vega-embed";
import { changeset } from "vega";

type Spec = VisualizationSpec | string;
type Renderer = "svg" | "canvas";
type NamedData = Record<string, Record<string, unknown>[]>;
type SignalValues = Record<string, unknown>;
type SignalListener = (name: string, value: unknown) => void;

/** A responsive Vega or Vega-Lite visualization as a custom element. */
export class VegaChart extends HTMLElement {
  private _spec: Spec | null = null;
  private _data: NamedData = {};
  private _signals: SignalValues = {};
  private _signalListeners: string[] = [];
  private _options: EmbedOptions = {};
  private _renderer: Renderer = "svg";
  private _actions = false;
  private result?: Result;
  private renderId = 0;
  private renderScheduled = false;
  private viewUpdateScheduled = false;
  private updateQueue: Promise<void> = Promise.resolve();
  private dataDirty = true;
  private signalsDirty = true;
  private applyingSignals = false;
  private signalCallbacks = new Map<string, SignalListener>();
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
    this.clearSignalListeners();
    this.result?.view.finalize();
    this.result = undefined;
  }

  get spec(): Spec | null {
    return this._spec;
  }

  set spec(value: Spec | null) {
    this._spec = value;
    this.dataDirty = true;
    this.signalsDirty = true;
    this.scheduleRender();
  }

  get data(): NamedData {
    return this._data;
  }

  set data(value: NamedData | null) {
    this._data = value && typeof value === "object" ? value : {};
    this.dataDirty = true;
    this.scheduleViewUpdate();
  }

  get signals(): SignalValues {
    return this._signals;
  }

  set signals(value: SignalValues | null) {
    this._signals = value && typeof value === "object" ? value : {};
    this.signalsDirty = true;
    this.scheduleViewUpdate();
  }

  get signal_listeners(): string[] {
    return this._signalListeners;
  }

  set signal_listeners(value: string[] | null) {
    this.clearSignalListeners();
    this._signalListeners = Array.isArray(value) ? [...new Set(value)] : [];
    try {
      this.attachSignalListeners();
    } catch (error) {
      this.reportError(error);
    }
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

  private scheduleViewUpdate(): void {
    if (!this.isConnected) return;
    if (!this.result) {
      this.scheduleRender();
      return;
    }
    if (this.viewUpdateScheduled) return;
    this.viewUpdateScheduled = true;
    queueMicrotask(() => {
      this.viewUpdateScheduled = false;
      this.updateQueue = this.updateQueue
        .then(() => this.updateView())
        .catch((error: unknown) => {
          this.reportError(error);
        });
    });
  }

  private async updateView(result = this.result): Promise<void> {
    if (!result) return;
    const updateData = this.dataDirty;
    const updateSignals = this.signalsDirty;
    if (!updateData && !updateSignals) return;
    this.dataDirty = false;
    this.signalsDirty = false;
    try {
      if (updateData) {
        for (const [name, values] of Object.entries(this._data)) {
          result.view.change(
            name,
            changeset()
              .remove(() => true)
              .insert(values),
          );
        }
      }
      this.applyingSignals = updateSignals;
      if (updateSignals) {
        for (const [name, value] of Object.entries(this._signals)) {
          result.view.signal(name, value);
        }
      }
      await result.view.runAsync();
    } catch (error) {
      this.dataDirty ||= updateData;
      this.signalsDirty ||= updateSignals;
      throw error;
    } finally {
      this.applyingSignals = false;
    }
    if (result !== this.result) return;
    delete this.dataset.error;
    this.dispatchEvent(
      new CustomEvent("vega-update", {
        detail: { data: updateData, signals: updateSignals, view: result.view },
      }),
    );
  }

  private attachSignalListeners(result = this.result): void {
    if (!result) return;
    for (const name of this._signalListeners) {
      const callback: SignalListener = (signal, value) => {
        if (result !== this.result || this.applyingSignals) return;
        this.dispatchEvent(
          new CustomEvent("vega-signal", {
            bubbles: true,
            composed: true,
            detail: { name: signal, value },
          }),
        );
      };
      result.view.addSignalListener(name, callback);
      this.signalCallbacks.set(name, callback);
    }
  }

  private clearSignalListeners(result = this.result): void {
    if (result) {
      for (const [name, callback] of this.signalCallbacks) {
        result.view.removeSignalListener(name, callback);
      }
    }
    this.signalCallbacks.clear();
  }

  private reportError(error: unknown, container?: HTMLElement): void {
    const message = error instanceof Error ? error.message : String(error);
    this.dataset.error = message;
    if (container) {
      container.className = "vega-chart-error";
      container.textContent = message;
    }
    this.dispatchEvent(
      new CustomEvent("vega-error", { detail: { error, message } }),
    );
  }

  private async render(): Promise<void> {
    const spec = this._spec;
    if (!spec) return;

    const id = ++this.renderId;
    this.dataDirty = true;
    this.signalsDirty = true;
    this.clearSignalListeners();
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
      this.attachSignalListeners(result);
      await this.updateView(result);
      if (id !== this.renderId || !this.isConnected) return;
      this.dataset.rendered = "true";
      this.dispatchEvent(
        new CustomEvent("vega-ready", { detail: { view: result.view } }),
      );
    } catch (error) {
      if (id !== this.renderId) return;
      this.reportError(error, container);
    }
  }
}

if (!customElements.get("vega-chart")) {
  customElements.define("vega-chart", VegaChart);
}
