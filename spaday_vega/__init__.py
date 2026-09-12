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

__all__ = ["VegaChart", "package"]
