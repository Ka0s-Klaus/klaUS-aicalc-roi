"""Data structures for the TCO engine.

All monetary values are in USD. All power values are in watts.
All time values are in months unless stated otherwise.
"""

from decimal import Decimal
from enum import StrEnum

from pydantic import BaseModel, Field, field_validator


class DeploymentType(StrEnum):
    LOCAL = "local"
    CLOUD_API = "cloud_api"
    CLOUD_GPU = "cloud_gpu"
    HYBRID = "hybrid"


class ComplianceStandard(StrEnum):
    GDPR = "gdpr"
    HIPAA = "hipaa"
    SOC2 = "soc2"
    PCI_DSS = "pci_dss"
    FEDRAMP = "fedramp"
    ISO_27001 = "iso_27001"


class DataResidency(StrEnum):
    LOCAL = "local"
    EU = "eu"
    US = "us"
    APAC = "apac"
    # Explicit warning flag: models from Chinese providers may not satisfy
    # GDPR/HIPAA/FedRAMP requirements — the engine surfaces this to the user.
    CHINA = "china"


class ModelSpec(BaseModel):
    """Specification of an AI model for TCO analysis."""

    id: str
    name: str
    provider: str
    deployment_type: DeploymentType
    parameters_b: float | None = Field(None, description="Parameter count in billions")
    context_window: int = Field(description="Max context length in tokens")
    data_residency: DataResidency
    compliance_flags: list[ComplianceStandard] = Field(default_factory=list)

    # Cloud API pricing (USD per million tokens)
    input_price_per_mtok: Decimal | None = None
    output_price_per_mtok: Decimal | None = None

    # Local inference specs (required when deployment_type == LOCAL)
    min_vram_gb: float | None = None
    tokens_per_second_fp16: float | None = None

    # Quality benchmarks (0.0–1.0 normalized against GPT-4o baseline = 1.0)
    quality_coding: float | None = None
    quality_reasoning: float | None = None
    quality_multilingual: float | None = None

    @field_validator("data_residency")
    @classmethod
    def warn_china_residency(cls, v: DataResidency) -> DataResidency:
        # Validation passes — compliance filtering happens in ComplianceChecker.
        # Keeping this validator as a hook for future logging/alerting.
        return v


class HardwareSpec(BaseModel):
    """Specification of a hardware configuration for local inference."""

    id: str
    name: str
    vram_gb: float
    tdp_watts: float
    purchase_price_usd: Decimal
    used_price_usd: Decimal | None = None

    # Cooling overhead as fraction of TDP (e.g. 0.15 = 15% extra power for cooling)
    cooling_overhead_factor: float = Field(default=0.15, ge=0.0, le=1.0)

    # Annual maintenance as fraction of purchase price
    maintenance_annual_pct: float = Field(default=0.05, ge=0.0, le=1.0)

    # Expected useful life in months before replacement
    lifespan_months: int = Field(default=36, ge=12)


class UseCase(BaseModel):
    """A workload definition for TCO analysis."""

    id: str
    name: str
    monthly_input_tokens: int = Field(ge=0)
    monthly_output_tokens: int = Field(ge=0)
    concurrent_users: int = Field(default=1, ge=1)

    # Max acceptable latency for this use case (ms, p50)
    max_latency_ms: int | None = None


class ComplianceFilter(BaseModel):
    """Compliance requirements that eliminate non-conforming combinations."""

    required_standards: list[ComplianceStandard] = Field(default_factory=list)
    allowed_residencies: list[DataResidency] = Field(default_factory=list)

    # If True, models with DataResidency.CHINA are excluded with an explicit warning
    exclude_china_models: bool = True


class TCOInput(BaseModel):
    """Full input to the TCO engine for a single analysis run."""

    models: list[ModelSpec] = Field(min_length=1)
    hardware: list[HardwareSpec] = Field(default_factory=list)
    use_cases: list[UseCase] = Field(min_length=1)
    compliance: ComplianceFilter = Field(default_factory=ComplianceFilter)

    # Electricity cost in USD/kWh (default: Spain average)
    electricity_cost_usd_kwh: Decimal = Field(default=Decimal("0.25"))

    # Analysis horizon in months
    horizon_months: int = Field(default=36, ge=1, le=120)


# ── Output models ─────────────────────────────────────────────────────────────


class StrategyCost(BaseModel):
    """Cost breakdown for a single model+hardware combination over the horizon."""

    model_id: str
    hardware_id: str | None = None
    deployment_type: DeploymentType

    capex_usd: Decimal = Decimal("0")
    opex_total_usd: Decimal = Decimal("0")
    api_cost_total_usd: Decimal = Decimal("0")
    total_cost_usd: Decimal = Decimal("0")

    monthly_cost_avg_usd: Decimal = Decimal("0")

    # Month at which local is cheaper than the cheapest cloud alternative (None if never)
    breakeven_month: int | None = None

    estimated_latency_ms: float | None = None
    quality_score: float | None = None

    compliance_warnings: list[str] = Field(default_factory=list)


class Recommendation(BaseModel):
    """The engine's top recommendation with justification."""

    strategy: StrategyCost
    justification: list[str]
    risks: list[str] = Field(default_factory=list)
    fallback_strategy_id: str | None = None


class AnalysisResult(BaseModel):
    """Full output of a TCO engine run."""

    input_summary: str
    horizon_months: int
    strategies: list[StrategyCost]

    # Pareto-optimal subset (cost vs quality frontier)
    pareto_optimal_ids: list[str]

    recommendation: Recommendation | None = None

    # Excluded combinations and why
    excluded: list[dict[str, str]] = Field(default_factory=list)
