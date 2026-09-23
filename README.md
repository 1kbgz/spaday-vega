<a href="https://github.com/1kbgz/spaday-vega">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://github.com/1kbgz/spaday-vega/raw/main/docs/img/logo-dark.webp?raw=true">
    <img alt="spaday-vega logo, a star field inside a browser window" src="https://github.com/1kbgz/spaday-vega/raw/main/docs/img/logo-light.webp?raw=true" width="600">
  </picture>
</a>

Declarative [Vega](https://vega.github.io/vega/) and [Vega-Lite](https://vega.github.io/vega-lite/) visualizations for [spaday](https://github.com/1kbgz/spaday).

[![Build Status](https://github.com/1kbgz/spaday-vega/actions/workflows/build.yaml/badge.svg?branch=main&event=push)](https://github.com/1kbgz/spaday-vega/actions/workflows/build.yaml)
[![codecov](https://codecov.io/gh/1kbgz/spaday-vega/branch/main/graph/badge.svg)](https://codecov.io/gh/1kbgz/spaday-vega)
[![License](https://img.shields.io/github/license/1kbgz/spaday-vega)](https://github.com/1kbgz/spaday-vega)
[![PyPI](https://img.shields.io/pypi/v/spaday-vega.svg)](https://pypi.python.org/pypi/spaday-vega)

## Usage

`VegaChart` accepts either grammar through the same typed Python component. Vega-Embed selects the correct runtime from the specification's `$schema`.

```python
from spaday.backends.starlette import serve
from spaday_vega import VegaChart, package

spec = {
    "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
    "data": {"name": "values"},
    "datasets": {"values": []},
    "mark": "bar",
    "encoding": {
        "x": {"field": "category", "type": "nominal"},
        "y": {"field": "value", "type": "quantitative"},
    },
}
data = {"values": [{"category": "A", "value": 12}, {"category": "B", "value": 21}]}

page = VegaChart(spec=spec, data=data, renderer="svg", actions=False)
app = serve(page, packages=[package], title="Vega-Lite chart")
```

`data` maps Vega dataset names to rows and `signals` maps signal names to values. Updating either property applies the change to the current view, preserving scroll position and chart interaction state. Set `signal_listeners` to the signal names that should produce `vega-signal` events; each event contains the signal's `name` and `value` in `detail`.

The bundled `<vega-chart>` custom element dispatches `vega-ready` after rendering, `vega-update` after applying data or signals, and `vega-error` when either operation fails. It also accepts serializable Vega-Embed `options`. Updating `spec`, `options`, `renderer`, or `actions` redraws the visualization and finalizes the previous view.

The element exposes its Vega `view` property for JavaScript code that needs the rest of the View API.

## Theming

Chart defaults follow spaday's shell palette. Set a component token on the chart or any ancestor to
theme Vega without changing its specification:

| Token                   | Controls                               | Shell fallback  |
| ----------------------- | -------------------------------------- | --------------- |
| `--spa-vega-background` | Chart background                       | `--spa-surface` |
| `--spa-vega-text`       | Titles, guides, and text marks         | `--spa-muted`   |
| `--spa-vega-axis`       | Axis domains and ticks                 | `--spa-muted`   |
| `--spa-vega-grid`       | Grid lines and legend gradient outline | `--spa-border`  |
| `--spa-vega-mark`       | Default mark color                     | `--spa-accent`  |
| `--spa-vega-danger`     | Rendering errors                       | `--spa-danger`  |

These are Vega configuration defaults. Colors declared by the specification or `options.config`
still win. Python authors can discover the same mapping as `spaday_vega.TOKENS` and set a token with
`VegaChart(...).css(spa_vega_mark="#4c78a8")`.

## Browser examples

- [Open the chart example](https://1kbgz.github.io/spaday-vega/lite/) ([source](spaday_vega/example.py)).

The browser example runs Python through Pyodide, so it needs no install or server. Each timer event travels from the browser to a Python model through Spaday and transports. Python returns three named datasets and a Vega signal, and each chart applies them to its existing view. Hovering a point sends a watched Vega signal back through Spaday and transports. The example includes native Vega and Vega-Lite specifications.

## Run the examples locally

```bash
python -m pip install -e ".[examples]"
python -m spaday_vega.example
```

Open `http://127.0.0.1:8028` for the example.

> [!NOTE]
> This library was generated using [copier](https://copier.readthedocs.io/en/stable/) from the [Base Python Project Template repository](https://github.com/python-project-templates/base).
