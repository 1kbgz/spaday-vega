import asyncio
import json

import httpx

from spaday_vega import example


def test_server_example_binds_chart_specs_to_transports():
    async def request():
        transport = httpx.ASGITransport(app=example.app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            return await client.get("/"), await client.get("/tree.json")

    home, tree = asyncio.run(request())
    assert home.status_code == 200
    assert tree.status_code == 200
    assert tree.text.count('"tag": "vega-chart"') == 3
    assert "charts.line_spec" in tree.text
    assert "charts.bar_spec" in tree.text
    assert "charts.scatter_spec" in tree.text
    assert 'document.addEventListener("spaday:patch"' in home.text
    assert "new WebSocket" in home.text


def test_worker_example_round_trips_through_transports_and_spaday():
    snapshot = example.worker_app.start()
    initial_specs = [
        example.worker_state.line_spec,
        example.worker_state.bar_spec,
        example.worker_state.scatter_spec,
    ]

    message = example.worker_app.dispatch(
        {
            "type": "spaday:patch",
            "detail": {
                "model": "charts",
                "field": "update_count",
                "value": 1,
            },
        }
    )

    assert snapshot["type"] == "snapshot"
    assert example.worker_state.update_count == 1
    assert [
        example.worker_state.line_spec,
        example.worker_state.bar_spec,
        example.worker_state.scatter_spec,
    ] != initial_specs
    assert message["type"] == "patch"
    assert message["patch"]["ops"]
    assert "vega-lite/v6.json" in json.dumps(message)
