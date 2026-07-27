"""GET /v1/models and GET /v1/hardware — static catalog endpoints."""

from typing import Annotated

from fastapi import APIRouter, Query

from backend.api.catalog import get_hardware, get_models
from backend.tco_engine.models import DataResidency, DeploymentType, HardwareSpec, ModelSpec

router = APIRouter(prefix="/v1", tags=["catalog"])


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
