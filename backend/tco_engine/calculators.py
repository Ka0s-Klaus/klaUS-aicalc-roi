"""Cost, latency and quality calculators for the TCO engine.

Each calculator is a pure function: given specs + use case + config → metric.
No IO, no side effects, fully testable in isolation.
"""

from decimal import Decimal

from .models import HardwareSpec, ModelSpec, StrategyCost, UseCase

_HOURS_PER_MONTH = Decimal("730")
_WATTS_TO_KW = Decimal("0.001")


def calculate_local_cost(
    model: ModelSpec,
    hardware: HardwareSpec,
    use_case: UseCase,
    electricity_usd_kwh: Decimal,
    horizon_months: int,
) -> StrategyCost:
    """CAPEX + OPEX for running a local model on owned/rented hardware."""
    qty = Decimal(str(hardware.quantity))
    capex = hardware.purchase_price_usd * qty

    # Monthly electricity: TDP × quantity × cooling overhead × hours × kWh rate
    power_kw = (
        Decimal(str(hardware.tdp_watts))
        * qty
        * (1 + Decimal(str(hardware.cooling_overhead_factor)))
        * _WATTS_TO_KW
    )
    monthly_electricity = power_kw * _HOURS_PER_MONTH * electricity_usd_kwh

    # Monthly maintenance (amortized annual %)
    monthly_maintenance = (
        hardware.purchase_price_usd * qty * Decimal(str(hardware.maintenance_annual_pct)) / 12
    )

    # Hardware replacement if horizon exceeds lifespan
    replacements = max(0, horizon_months // hardware.lifespan_months - 1)
    replacement_cost = hardware.purchase_price_usd * qty * replacements

    opex_total = (monthly_electricity + monthly_maintenance) * horizon_months + replacement_cost
    total = capex + opex_total
    monthly_avg = total / horizon_months

    latency = _estimate_local_latency(model, hardware, use_case)

    return StrategyCost(
        model_id=model.id,
        hardware_id=hardware.id,
        deployment_type=model.deployment_type,
        capex_usd=capex,
        opex_total_usd=opex_total,
        total_cost_usd=total,
        monthly_cost_avg_usd=monthly_avg,
        monthly_electricity_usd=monthly_electricity,
        monthly_maintenance_usd=monthly_maintenance,
        estimated_latency_ms=latency,
        quality_score=_aggregate_quality(model),
    )


def calculate_cloud_api_cost(
    model: ModelSpec,
    use_case: UseCase,
    horizon_months: int,
) -> StrategyCost:
    """API token cost for a cloud-hosted model over the analysis horizon."""
    if model.input_price_per_mtok is None or model.output_price_per_mtok is None:
        raise ValueError(f"Model {model.id} is missing API pricing data")

    monthly_input_cost = (
        Decimal(str(use_case.monthly_input_tokens)) / Decimal("1_000_000")
    ) * model.input_price_per_mtok

    monthly_output_cost = (
        Decimal(str(use_case.monthly_output_tokens)) / Decimal("1_000_000")
    ) * model.output_price_per_mtok

    monthly_cost = monthly_input_cost + monthly_output_cost
    total = monthly_cost * horizon_months

    return StrategyCost(
        model_id=model.id,
        hardware_id=None,
        deployment_type=model.deployment_type,
        api_cost_total_usd=total,
        total_cost_usd=total,
        monthly_cost_avg_usd=monthly_cost,
        estimated_latency_ms=model.estimated_latency_ms,
        quality_score=_aggregate_quality(model),
    )


def calculate_breakeven(local: StrategyCost, cloud: StrategyCost) -> int | None:
    """Return the month at which local total cost drops below cloud total cost.

    Returns None if local never becomes cheaper within the horizon.
    """
    if local.capex_usd == 0 or cloud.monthly_cost_avg_usd == 0:
        return None

    # Simplified linear model: capex amortizes as cloud costs accumulate
    monthly_delta = cloud.monthly_cost_avg_usd - local.monthly_cost_avg_usd
    if monthly_delta <= 0:
        return None  # local is always more expensive

    breakeven = local.capex_usd / monthly_delta
    return int(breakeven.to_integral_value()) + 1


def _estimate_local_latency(
    model: ModelSpec, hardware: HardwareSpec, use_case: UseCase
) -> float | None:
    """Rough TTFT estimate in ms based on tokens/sec throughput and queue depth."""
    if model.tokens_per_second_fp16 is None:
        return None

    # VRAM check: model must fit across all units
    if model.min_vram_gb and (hardware.vram_gb * hardware.quantity) < model.min_vram_gb:
        return None

    # Average output length assumed at 256 tokens for latency estimate
    avg_output_tokens = 256
    generation_ms = (avg_output_tokens / model.tokens_per_second_fp16) * 1000

    # Queue factor: concurrent users increase wait time linearly (simplified)
    queue_factor = max(1.0, use_case.concurrent_users * 0.5)

    return generation_ms * queue_factor


def _aggregate_quality(model: ModelSpec) -> float | None:
    """Simple average of available benchmark scores."""
    scores = [
        s
        for s in [model.quality_coding, model.quality_reasoning, model.quality_multilingual]
        if s is not None
    ]
    return sum(scores) / len(scores) if scores else None
