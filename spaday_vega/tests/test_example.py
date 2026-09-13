import asyncio

import httpx

from spaday_vega import example


def test_server_example_binds_chart_data_to_transports():
    async def request():
        transport = httpx.ASGITransport(app=example.app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            return await client.get("/"), await client.get("/tree.json")

    home, tree = asyncio.run(request())
    assert home.status_code == 200
    assert tree.status_code == 200
    assert tree.text.count('"tag": "vega-chart"') == 3
    assert "charts.line_data" in tree.text
    assert "charts.line_signals" in tree.text
    assert "charts.bar_data" in tree.text
    assert "charts.scatter_data" in tree.text
    assert "charts.hovered" in tree.text
    assert "vega-signal" in tree.text
    assert 'document.addEventListener("spaday:patch"' in home.text
    assert "new WebSocket" in home.text


def test_worker_example_round_trips_through_transports_and_spaday():
    snapshot = example.worker_app.start()
    initial_data = [
        example.worker_state.line_data,
        example.worker_state.bar_data,
        example.worker_state.scatter_data,
    ]
    initial_signals = example.worker_state.line_signals

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
        example.worker_state.line_data,
        example.worker_state.bar_data,
        example.worker_state.scatter_data,
    ] != initial_data
    assert example.worker_state.line_signals != initial_signals
    assert message["type"] == "patch"
    assert message["patch"]["ops"]
    data_patches = [
        operation["SetProp"] for operation in message["patch"]["ops"] if "SetProp" in operation and operation["SetProp"]["name"] == "data"
    ]
    assert len(data_patches) == 3
    assert sum(operation["SetProp"]["name"] == "signals" for operation in message["patch"]["ops"] if "SetProp" in operation) == 1

    example.worker_app.dispatch(
        {
            "type": "spaday:patch",
            "detail": {
                "model": "charts",
                "field": "hovered",
                "value": "10:00",
            },
        }
    )
    assert example.worker_state.hovered == "10:00"
