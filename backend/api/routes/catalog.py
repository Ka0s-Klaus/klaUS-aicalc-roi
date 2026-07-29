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
    concurrent_users: Annotated[
        int,
        Query(description="Number of concurrent users to support", ge=1),
    ] = 1,
    precision: Annotated[
        str,
        Query(description="Inference precision: FP16, FP8, or INT4"),
    ] = "FP16",
    context_window_tokens: Annotated[
        int,
        Query(description="Average context window in tokens", ge=512, le=131072),
    ] = 4096,
    model_params_billions: Annotated[
        float | None,
        Query(description="Model size in billions of parameters (optional, improves KV cache calc)", ge=0.5),
    ] = None,
) -> list[HardwareRecommendation]:
    """Return hardware options sorted by the minimum number of units needed to fit a model.

    Dimensioning formula considers:
    1. Model weights VRAM: min_vram_gb
    2. KV cache per concurrent user based on:
       - model_params_billions: model size
       - context_window_tokens: context length
       - precision: FP16 (2 bytes), FP8 (1 byte), INT4 (0.5 bytes)
    3. Total VRAM needed = model_weights + (KV_cache_per_user × concurrent_users)

    References:
    - KV cache formula: 2 × L × H_kv × D × S × bytes_per_element
    - Approximation: KV_cache_GB ≈ (params_B / 1000) × context_tokens × precision_factor
    - Typical ratios for LLM inference on H100/A100 with batching

    Options requiring more than 8 units are excluded.
    """
    # Precision factor (bytes per element in KV cache)
    precision_factors = {"FP16": 1.0, "FP8": 0.5, "INT4": 0.25}
    precision_factor = precision_factors.get(precision, 1.0)

    # Calculate KV cache per user in GB
    # Approximation: kv_cache_gb ≈ (model_size_billions / 1000) × context_tokens × precision_factor × 0.000122
    # The 0.000122 is an empirical scaling constant from industry data
    kv_cache_per_user_gb = 0.0
    if model_params_billions and model_params_billions > 0:
        # Refined formula: KV cache size scales with model params, context, and precision
        # Base: 2 bytes per parameter per layer for KV (simplified across all layers)
        kv_cache_per_user_gb = (
            (model_params_billions / 1000)
            * context_window_tokens
            * precision_factor
            * 0.000122
        )

    results: list[HardwareRecommendation] = []
    for hw in get_hardware():
        # Units required to fit model weights
        units_for_model = math.ceil(min_vram_gb / hw.vram_gb)

        # Calculate total VRAM needed for concurrent users
        # Available VRAM per GPU after model weights
        available_vram_per_gpu = hw.vram_gb - (min_vram_gb / units_for_model)
        if available_vram_per_gpu < 0:
            available_vram_per_gpu = 0

        # Units needed to hold KV cache for all concurrent users
        total_kv_cache_needed = kv_cache_per_user_gb * concurrent_users
        units_for_kv = math.ceil(total_kv_cache_needed / available_vram_per_gpu) if available_vram_per_gpu > 0 else concurrent_users

        # Take the maximum: must fit model AND concurrent users' KV cache
        units_needed = max(units_for_model, units_for_kv)
        units_needed = max(units_needed, 1)  # At least 1 unit

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
