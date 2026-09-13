"""Charts updated by Python through Spaday and transports."""

from typing import Literal

import transports
from pydantic import BaseModel, Field, model_validator
from spaday import SendPatch, Wire, WorkerApp, element, event_prop
from spaday.backends.starlette import serve
from spaday.components.shell import App, Body, Main, Nav
from starlette.routing import WebSocketRoute

from . import VegaChart, package
from .example_charts import bar_spec, bar_values, line_signals, line_spec, line_values, scatter_spec, scatter_values


class ChartState(BaseModel):
    update_count: int = 0
    hovered: str = "None"
    line_data: dict[str, list[dict]] = Field(default_factory=dict)
    line_signals: dict[str, int] = Field(default_factory=dict)
    bar_data: dict[str, list[dict]] = Field(default_factory=dict)
    scatter_data: dict[str, list[dict]] = Field(default_factory=dict)

    @model_validator(mode="after")
    def update_data(self):
        self.line_data = {"values": line_values(self.update_count)}
        self.line_signals = line_signals(self.update_count)
        self.bar_data = {"values": bar_values(self.update_count)}
        self.scatter_data = {"values": scatter_values(self.update_count)}
        return self


def transport_clock(state: ChartState, *, bound: bool):
    count = element("strong", id="update-count")
    if bound:
        count.bind("textContent", "charts.update_count")
    else:
        count.text(str(state.update_count))
    return element(
        "div",
        element("span", "Updates from Python"),
        count,
        class_="transport-clock",
    ).on(
        "animationiteration",
        SendPatch("charts", "update_count", event_prop("elapsedTime")),
    )


def chart_card(
    state: ChartState,
    spec: dict,
    data_field: str,
    title: str,
    description: str,
    *,
    renderer: Literal["svg", "canvas"] = "svg",
    bound: bool,
    signals_field: str | None = None,
):
    chart = VegaChart(
        spec=spec,
        data=None if bound else getattr(state, data_field),
        signals=None if bound or signals_field is None else getattr(state, signals_field),
        signal_listeners=["hovered"] if signals_field else None,
        renderer=renderer,
        actions=False,
    )
    if bound:
        chart.bind("data", f"charts.{data_field}")
        if signals_field:
            chart.bind("signals", f"charts.{signals_field}")
    if signals_field:
        chart.on("vega-signal", SendPatch("charts", "hovered", event_prop("detail.value")))
    return element(
        "article",
        element("h2", title),
        element("p", description),
        chart,
        class_="chart-card",
    )


def build_page(state: ChartState, *, bound: bool):
    return App(
        Nav(
            element("strong", "spaday-vega"),
            element("span", "Python + Spaday + transports + Vega", class_="nav-label"),
        ),
        Body(
            Main(
                element(
                    "header",
                    element("h1", "Vega charts"),
                    element(
                        "p",
                        "Each update travels to Python through Spaday and transports, then updates a named Vega dataset.",
                    ),
                    transport_clock(state, bound=bound),
                    element(
                        "p",
                        "Hovered point: ",
                        (
                            element("strong", id="hovered-point").bind("textContent", "charts.hovered")
                            if bound
                            else element("strong", state.hovered, id="hovered-point")
                        ),
                        class_="hovered-point",
                    ),
                    class_="intro",
                ),
                element(
                    "section",
                    chart_card(
                        state,
                        line_spec(),
                        "line_data",
                        "Live values",
                        "A native Vega chart using values returned by Python.",
                        bound=bound,
                        signals_field="line_signals",
                    ),
                    chart_card(
                        state,
                        bar_spec(),
                        "bar_data",
                        "Category totals",
                        "A Vega-Lite bar chart using values returned by Python.",
                        bound=bound,
                    ),
                    chart_card(
                        state,
                        scatter_spec(),
                        "scatter_data",
                        "Value comparison",
                        "A Vega-Lite scatter plot using values returned by Python.",
                        renderer="canvas",
                        bound=bound,
                    ),
                    class_="chart-grid",
                ),
                class_="page",
            )
        ),
    )


server_state = ChartState()
server_session = transports.Session()
server_session.host(server_state)
transport_server = transports.Server(server_session)


worker_state = ChartState()
worker_session = transports.Session()
worker_model_id = worker_session.host(worker_state)
worker_server = transports.Server(worker_session, default_codec="msgpack")
worker_client = transports.Client(codec="msgpack")
for frame in worker_server.open("browser", "msgpack"):
    worker_client.recv(frame)


def process_worker_intent(intent: dict) -> None:
    detail = intent["detail"]
    if detail["model"] != "charts" or detail["field"] not in {"hovered", "update_count"}:
        return
    proposal = worker_client.model(worker_model_id, ChartState).model_copy()
    if detail["field"] == "update_count":
        proposal.update_count = int(detail["value"])
    else:
        proposal.hovered = str(detail["value"])
    outbound = worker_client.edit(worker_model_id, transports.to_value(proposal))
    for frame in worker_server.recv("browser", outbound)["browser"]:
        worker_client.recv(frame)


worker_app = WorkerApp(
    lambda: build_page(worker_state, bound=False),
    process_worker_intent,
)
page = build_page(server_state, bound=True)

styles = """
<style>
  * { box-sizing: border-box; }
  body { margin: 0; color: #172033; background: #f5f7fb; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
  spa-nav { display: flex; align-items: center; justify-content: space-between; padding: .9rem clamp(1rem, 4vw, 3rem); background: white; border-bottom: 1px solid #dce2ec; }
  .nav-label { color: #64748b; font-size: .85rem; }
  .page { display: grid; gap: 1rem; width: min(100%, 76rem); margin: auto; padding: clamp(1rem, 3vw, 2.5rem); }
  .intro { padding: clamp(1.25rem, 3vw, 2rem); color: white; background: #1e3a8a; border-radius: 1rem; }
  .intro h1 { margin: 0 0 .5rem; font-size: clamp(2rem, 5vw, 3.5rem); letter-spacing: -.04em; }
  .intro p { max-width: 48rem; margin: 0; color: #dbeafe; line-height: 1.6; }
  .transport-clock { display: inline-flex; gap: .5rem; margin-top: 1rem; padding: .45rem .65rem; border: 1px solid #ffffff52; border-radius: .5rem; color: #dbeafe; font-size: .8rem; animation: transport-tick 1s linear infinite; }
  .transport-clock strong { color: white; }
  .chart-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; align-items: start; }
  .chart-card { min-width: 0; padding: clamp(1rem, 2.5vw, 1.5rem); background: white; border: 1px solid #dce2ec; border-radius: .9rem; box-shadow: 0 8px 28px #1720330a; }
  .chart-card:first-child { grid-column: span 2; }
  .chart-card h2 { margin: 0 0 .3rem; font-size: 1.15rem; }
  .chart-card > p { margin: 0 0 1rem; color: #64748b; line-height: 1.5; }
  .chart-card vega-chart { min-height: 16rem; }
  @keyframes transport-tick { from { opacity: .999; } to { opacity: 1; } }
  @media (max-width: 720px) { .chart-grid { grid-template-columns: 1fr; } .chart-card:first-child { grid-column: auto; } }
</style>
"""

app = serve(
    page,
    packages=[package],
    wire=[Wire("/ws", namespace="charts", flatten=False)],
    routes=[WebSocketRoute("/ws", transports.ws_endpoint(transport_server))],
    head=styles,
    title="spaday-vega example",
)

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8028)
