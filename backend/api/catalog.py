"""Static catalog loader — reads models.json and hardware.json once and caches the result."""

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from backend.tco_engine.models import HardwareSpec, ModelSpec

_DATA_DIR = Path(__file__).parent.parent / "data"


def _strip_meta(entry: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in entry.items() if not k.startswith("_")}


@lru_cache(maxsize=1)
def get_models() -> list[ModelSpec]:
    data: dict[str, list[dict[str, Any]]] = json.loads((_DATA_DIR / "models.json").read_text())
    return [ModelSpec.model_validate(_strip_meta(e)) for e in data["models"]]


@lru_cache(maxsize=1)
def get_hardware() -> list[HardwareSpec]:
    data: dict[str, list[dict[str, Any]]] = json.loads((_DATA_DIR / "hardware.json").read_text())
    return [HardwareSpec.model_validate(_strip_meta(e)) for e in data["hardware"]]
