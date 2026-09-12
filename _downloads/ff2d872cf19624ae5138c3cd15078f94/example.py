"""Charts updated by Python through Spaday and transports."""

import math

import transports
from pydantic import BaseModel, Field, model_validator
from spaday import SendPatch, Wire, WorkerApp, element, event_prop
from spaday.backends.starlette import serve
from spaday.components.shell import App, Body, Main, Nav
from starlette.routing import WebSocketRoute

from . import VegaChart, package


def line_values(tick: int) -> list[dict]:
    base = [18, 25, 22, 31, 28, 36]
    return [
        {
            "label": f"{hour:02}:00",
            "value": value + round(math.sin((tick + index) / 1.4) * 4),
        }
        for index, (hour, value) in enumerate(zip(range(9, 15), base, strict=True))
    ]


def bar_values(tick: int) -> list[dict]:
    return [
        {
            "category": category,
            "total": total + round(math.sin((tick + index) / 1.3) * 8),
        }
        for index, (category, total) in enumerate([("Alpha", 34), ("Beta", 55), ("Gamma", 42), ("Delta", 67)])
    ]


def scatter_values(tick: int) -> list[dict]:
    points = [
        ("A", 12, 18),
        ("A", 20, 31),
        ("B", 28, 24),
        ("B", 35, 42),
        ("C", 44, 37),
        ("C", 51, 55),
    ]
    return [
        {
            "group": group,
            "x": x + round(math.sin((tick + index) / 1.8) * 4),
            "y": y + round(math.cos((tick + index) / 1.5) * 4),
        }
        for index, (group, x, y) in enumerate(points)
    ]


def line_spec(tick: int) -> dict:
    return {
        "$schema": "https://vega.github.io/schema/vega/v6.json",
        "description": "Values supplied by Python",
        "width": 900,
        "height": 250,
        "padding": 8,
        "autosize": {"type": "fit", "contains": "padding", "resize": True},
        "data": [{"name": "values", "values": line_values(tick)}],
        "scales": [
            {
                "name": "x",
                "type": "point",
                "domain": {"data": "values", "field": "label"},
                "range": "width",
            },
            {
                "name": "y",
                "type": "linear",
                "domain": {"data": "values", "field": "value"},
                "range": "height",
                "nice": True,
                "zero": True,
            },
        ],
        "axes": [
            {"orient": "bottom", "scale": "x", "title": None},
            {"orient": "left", "scale": "y", "title": "Value"},
        ],
        "marks": [
            {
                "type": "line",
                "from": {"data": "values"},
                "encode": {
                    "update": {
                        "x": {"scale": "x", "field": "label"},
                        "y": {"scale": "y", "field": "value"},
                        "stroke": {"value": "#2563eb"},
                        "strokeWidth": {"value": 3},
                        "interpolate": {"value": "monotone"},
                    }
                },
            },
            {
                "type": "symbol",
                "from": {"data": "values"},
                "encode": {
                    "update": {
                        "x": {"scale": "x", "field": "label"},
                        "y": {"scale": "y", "field": "value"},
                        "size": {"value": 70},
                        "fill": {"value": "#2563eb"},
                        "tooltip": {"signal": "datum.label + ': ' + datum.value"},
                    }
                },
            },
        ],
    }


def bar_spec(tick: int) -> dict:
    return {
        "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
        "description": "Category totals supplied by Python",
        "width": "container",
        "height": 240,
        "data": {"values": bar_values(tick)},
        "mark": {"type": "bar", "cornerRadiusEnd": 4, "color": "#2563eb"},
        "encoding": {
            "x": {
                "field": "total",
                "type": "quantitative",
                "axis": {"title": "Total"},
            },
            "y": {
                "field": "category",
                "type": "nominal",
                "axis": {"title": None},
            },
            "tooltip": [
                {"field": "category", "type": "nominal"},
                {"field": "total", "type": "quantitative"},
            ],
        },
        "config": {"background": "transparent", "view": {"stroke": None}},
    }


def scatter_spec(tick: int) -> dict:
    return {
        "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
        "description": "Points supplied by Python",
        "width": "container",
        "height": 240,
        "data": {"values": scatter_values(tick)},
        "mark": {"type": "point", "filled": True, "size": 180},
        "encoding": {
            "x": {
                "field": "x",
                "type": "quantitative",
                "title": "X value",
                "scale": {"domain": [0, 60]},
            },
            "y": {
                "field": "y",
                "type": "quantitative",
                "title": "Y value",
                "scale": {"domain": [0, 60]},
            },
            "color": {
                "field": "group",
                "type": "nominal",
                "scale": {"range": ["#2563eb", "#0f766e", "#b45309"]},
            },
            "tooltip": [
                {"field": "group", "type": "nominal"},
                {"field": "x", "type": "quantitative"},
                {"field": "y", "type": "quantitative"},
            ],
        },
        "config": {"background": "transparent", "view": {"stroke": None}},
    }


class ChartState(BaseModel):
    update_count: int = 0
    line_spec: dict = Field(default_factory=dict)
    bar_spec: dict = Field(default_factory=dict)
    scatter_spec: dict = Field(default_factory=dict)

    @model_validator(mode="after")
    def update_specs(self):
        self.line_spec = line_spec(self.update_count)
        self.bar_spec = bar_spec(self.update_count)
        self.scatter_spec = scatter_spec(self.update_count)
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
    field: str,
    title: str,
    description: str,
    *,
    renderer: str = "svg",
    bound: bool,
):
    chart = VegaChart(renderer=renderer, actions=False)
    if bound:
        chart.bind("spec", f"charts.{field}")
    else:
        chart = VegaChart(spec=getattr(state, field), renderer=renderer, actions=False)
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
                        "Each update travels to Python through Spaday and transports, then returns as a new chart specification.",
                    ),
                    transport_clock(state, bound=bound),
                    class_="intro",
                ),
                element(
                    "section",
                    chart_card(
                        state,
                        "line_spec",
                        "Live values",
                        "A native Vega chart using values returned by Python.",
                        bound=bound,
                    ),
                    chart_card(
                        state,
                        "bar_spec",
                        "Category totals",
                        "A Vega-Lite bar chart using values returned by Python.",
                        bound=bound,
                    ),
                    chart_card(
                        state,
                        "scatter_spec",
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
    if detail["model"] != "charts" or detail["field"] != "update_count":
        return
    proposal = worker_client.model(worker_model_id, ChartState).model_copy()
    proposal.update_count = int(detail["value"])
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
