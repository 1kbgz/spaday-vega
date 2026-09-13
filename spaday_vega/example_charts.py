"""Chart specifications and generated data for the bundled example."""

import math


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


def line_signals(tick: int) -> dict[str, int]:
    return {"threshold": 27 + round(math.sin(tick / 1.5) * 3)}


def line_spec() -> dict:
    return {
        "$schema": "https://vega.github.io/schema/vega/v6.json",
        "description": "Values supplied by Python",
        "width": 900,
        "height": 250,
        "padding": 8,
        "autosize": {"type": "fit", "contains": "padding", "resize": True},
        "signals": [
            {"name": "threshold", "value": 27},
            {
                "name": "hovered",
                "value": "None",
                "on": [
                    {"events": "symbol:mouseover", "update": "datum.label"},
                    {"events": "symbol:mouseout", "update": "'None'"},
                ],
            },
        ],
        "data": [{"name": "values"}],
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
                "type": "rule",
                "encode": {
                    "update": {
                        "x": {"value": 0},
                        "x2": {"signal": "width"},
                        "y": {"scale": "y", "signal": "threshold"},
                        "stroke": {"value": "#94a3b8"},
                        "strokeDash": {"value": [5, 4]},
                    }
                },
            },
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


def bar_spec() -> dict:
    return {
        "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
        "description": "Category totals supplied by Python",
        "width": "container",
        "height": 240,
        "data": {"name": "values"},
        "datasets": {"values": []},
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


def scatter_spec() -> dict:
    return {
        "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
        "description": "Points supplied by Python",
        "width": "container",
        "height": 240,
        "data": {"name": "values"},
        "datasets": {"values": []},
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
