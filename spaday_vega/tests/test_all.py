import ast
from pathlib import Path

from spaday import generate
from spaday.bootstrap import bootstrap

from spaday_vega import VegaChart, package

ROOT = Path(__file__).parent.parent


def test_chart_serializes_declarative_properties():
    spec = {"$schema": "https://vega.github.io/schema/vega-lite/v6.json", "mark": "bar"}
    node = VegaChart(spec=spec, options={"theme": "quartz"}, renderer="canvas", actions=True).to_node()

    assert node["tag"] == "vega-chart"
    assert node["props"]["spec"]["Map"]["mark"] == {"Str": "bar"}
    assert node["props"]["spec"]["Map"]["$schema"] == {"Str": "https://vega.github.io/schema/vega-lite/v6.json"}
    assert node["props"]["options"] == {"Map": {"theme": {"Str": "quartz"}}}
    assert node["props"]["renderer"] == {"Str": "canvas"}
    assert node["props"]["actions"] == {"Bool": True}


def test_package_drives_bootstrap_assets_and_catalog():
    assert [schema.tag for schema in package.catalog] == ["vega-chart"]
    html = bootstrap(packages=[package])
    assert 'href="/components/vega/css/index.css"' in html
    assert 'src="/components/vega/cdn/index.js"' in html


def test_generated_component_is_current():
    fresh = generate(str(ROOT / "components.cem.json"))
    assert ast.dump(ast.parse(fresh)) == ast.dump(ast.parse((ROOT / "components.py").read_text(encoding="utf-8")))
