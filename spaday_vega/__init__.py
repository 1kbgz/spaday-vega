import json
from pathlib import Path

from spaday import ComponentPackage

from .components import VegaChart

__version__ = "0.1.0"

_EXTENSION = Path(__file__).parent / "extension"
_VERSIONS = _EXTENSION / "versions.json"

package = ComponentPackage(
    name="vega",
    assets_dir=_EXTENSION,
    assets=(("css", "css/index.css"), ("js", "cdn/index.js")),
    components=(VegaChart,),
    provides=json.loads(_VERSIONS.read_text(encoding="utf-8")) if _VERSIONS.exists() else {},
)

#: ``css()`` kwarg → (CSS custom property, what it controls), in the shape of
#: :data:`spaday.theme.SHELL_TOKENS`. Values become Vega configuration defaults, so an explicit
#: specification or ``options.config`` value still wins.
TOKENS = {
    "spa_vega_background": ("--spa-vega-background", "chart background (defaults to --spa-surface)"),
    "spa_vega_text": ("--spa-vega-text", "title, axis, legend, and text-mark color (defaults to --spa-muted)"),
    "spa_vega_axis": ("--spa-vega-axis", "axis domain and tick color (defaults to --spa-muted)"),
    "spa_vega_grid": ("--spa-vega-grid", "axis grid and legend gradient outline (defaults to --spa-border)"),
    "spa_vega_mark": ("--spa-vega-mark", "default mark color (defaults to --spa-accent)"),
    "spa_vega_danger": ("--spa-vega-danger", "rendering error color (defaults to --spa-danger)"),
}

__all__ = ["TOKENS", "VegaChart", "package"]
