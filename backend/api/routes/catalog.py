"""GET /v1/models, GET /v1/hardware and GET /v1/hardware/recommend — static catalog endpoints."""

import math
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Query
from pydantic import BaseModel

from backend.api.catalog import get_hardware, get_models
from backend.tco_engine.models import DataResidency, DeploymentType, HardwareSpec, ModelSpec

router = APIRouter(prefix="/v1", tags=["catalog"])

_MAX_UNITS = 8


class HardwareRecommendation(BaseModel):
    """A hardware option paired with the minimum number of units required to serve a model."""

    hardware: HardwareSpec
    units_needed: int
    total_vram_gb: float
    total_price_usd: Decimal


@router.get("/models")
async def list_models(
    deployment_type: Annotated[DeploymentType | None, Query(description="Filter by deployment type")] = None,
    data_residency: Annotated[DataResidency | None, Query(description="Filter by data residency")] = None,
) -> list[ModelSpec]:
    """Return the static model catalog, optionally filtered."""
    models = get_models()
    if deployment_type is not None:
        models = [m for m in models if m.deployment_type == deployment_type]
    if data_residency is not None:
        models = [m for m in models if m.data_residency == data_residency]
    return models


@router.get("/hardware")
async def list_hardware() -> list[HardwareSpec]:
    """Return the static hardware catalog."""
    return get_hardware()


@router.get("/hardware/recommend")
async def recommend_hardware(
    min_vram_gb: Annotated[
        float,
        Query(description="Minimum VRAM required by the model, in GB", gt=0),
    ],
) -> list[HardwareRecommendation]:
    """Return hardware options sorted by the minimum number of units needed to fit a model.

    For each GPU in the catalog, computes units_needed = ceil(min_vram_gb / hw.vram_gb).
    Options requiring more than 8 units are excluded. Results are sorted by
    (units_needed ASC, total_price_usd ASC) — cheapest single-unit option first.
    """
    results: list[HardwareRecommendation] = []
    for hw in get_hardware():
        units_needed = math.ceil(min_vram_gb / hw.vram_gb)
        if units_needed > _MAX_UNITS:
            continue
        results.append(
            HardwareRecommendation(
                hardware=hw,
                units_needed=units_needed,
                total_vram_gb=hw.vram_gb * units_needed,
                total_price_usd=hw.purchase_price_usd * units_needed,
            )
        )

    results.sort(key=lambda r: (r.units_needed, r.total_price_usd))
    return results
