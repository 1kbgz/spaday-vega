# spaday-vega

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
    "data": {"values": [{"category": "A", "value": 12}, {"category": "B", "value": 21}]},
    "mark": "bar",
    "encoding": {
        "x": {"field": "category", "type": "nominal"},
        "y": {"field": "value", "type": "quantitative"},
    },
}

page = VegaChart(spec=spec, renderer="svg", actions=False)
app = serve(page, packages=[package], title="Vega-Lite chart")
```

The bundled `<vega-chart>` custom element also accepts serializable Vega-Embed `options`. Updating `spec`, `options`, `renderer`, or `actions` redraws the visualization and finalizes the previous Vega view. Successful and failed renders dispatch `vega-ready` and `vega-error` events.

This first pass accepts declarative specifications. It does not wrap every method in Vega's View API.

> [!NOTE]
> This library was generated using [copier](https://copier.readthedocs.io/en/stable/) from the [Base Python Project Template repository](https://github.com/python-project-templates/base).

## Browser examples

- [Open the chart example](https://1kbgz.github.io/spaday-vega/lite/) ([source](spaday_vega/example.py)).

The browser example runs Python through Pyodide, so it needs no install or server. Each timer event travels from the browser to a Python model through Spaday and transports. Python updates all three specifications, and Spaday patches the existing chart elements with the returned values. The example includes native Vega and Vega-Lite specifications.

## Run the examples locally

```bash
python -m pip install -e ".[examples]"
python -m spaday_vega.example
```

Open `http://127.0.0.1:8028` for the example.
