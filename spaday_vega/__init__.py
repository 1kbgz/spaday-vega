import json
from pathlib import Path

from spaday import ComponentPackage, Token

from .components import VegaChart

__version__ = "0.1.1"

_EXTENSION = Path(__file__).parent / "extension"
_VERSIONS = _EXTENSION / "versions.json"

package = ComponentPackage(
    name="vega",
    assets_dir=_EXTENSION,
    assets=(("css", "css/index.css"), ("js", "cdn/index.js")),
    components=(VegaChart,),
    provides=json.loads(_VERSIONS.read_text(encoding="utf-8")) if _VERSIONS.exists() else {},
)

#: ``css()`` kwarg → (CSS custom property, what it controls). Values become Vega configuration defaults, so an explicit
#: specification or ``options.config`` value still wins.
TOKENS = {
    "spa_vega_background": Token("--spa-vega-background", "chart background", fallback="--spa-surface"),
    "spa_vega_text": Token("--spa-vega-text", "title, axis, legend, and text-mark color", fallback="--spa-muted"),
    "spa_vega_axis": Token("--spa-vega-axis", "axis domain and tick color", fallback="--spa-muted"),
    "spa_vega_grid": Token("--spa-vega-grid", "axis grid and legend gradient outline", fallback="--spa-border"),
    "spa_vega_mark": Token("--spa-vega-mark", "default mark color", fallback="--spa-accent"),
    "spa_vega_danger": Token("--spa-vega-danger", "rendering error color", fallback="--spa-danger"),
}

__all__ = ["TOKENS", "VegaChart", "package"]
