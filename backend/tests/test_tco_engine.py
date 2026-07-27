"""Tests for the TCO engine core — verifies calculations and compliance filtering."""

from decimal import Decimal

import pytest

from backend.tco_engine import TCOEngine
from backend.tco_engine.models import (
    ComplianceFilter,
    ComplianceStandard,
    DataResidency,
    DeploymentType,
    HardwareSpec,
    ModelSpec,
    TCOInput,
    UseCase,
)

# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture
def rtx_4090() -> HardwareSpec:
    return HardwareSpec(
        id="rtx-4090",
        name="NVIDIA RTX 4090",
        vram_gb=24.0,
        tdp_watts=450,
        purchase_price_usd=Decimal("1800"),
        lifespan_months=36,
    )


@pytest.fixture
def llama_70b() -> ModelSpec:
    return ModelSpec(
        id="llama-4-70b",
        name="Llama 4 70B",
        provider="Meta",
        deployment_type=DeploymentType.LOCAL,
        parameters_b=70,
        context_window=128000,
        data_residency=DataResidency.LOCAL,
        min_vram_gb=40,  # Requires multi-GPU or quantization
        tokens_per_second_fp16=15.0,
        quality_coding=0.88,
        quality_reasoning=0.85,
    )


@pytest.fixture
def llama_8b() -> ModelSpec:
    return ModelSpec(
        id="llama-4-8b",
        name="Llama 4 8B",
        provider="Meta",
        deployment_type=DeploymentType.LOCAL,
        parameters_b=8,
        context_window=128000,
        data_residency=DataResidency.LOCAL,
        min_vram_gb=8.0,
        tokens_per_second_fp16=80.0,
        quality_coding=0.72,
        quality_reasoning=0.68,
    )


@pytest.fixture
def claude_sonnet() -> ModelSpec:
    return ModelSpec(
        id="claude-sonnet-4-6",
        name="Claude Sonnet 4.6",
        provider="Anthropic",
        deployment_type=DeploymentType.CLOUD_API,
        parameters_b=None,
        context_window=200000,
        data_residency=DataResidency.US,
        compliance_flags=[ComplianceStandard.SOC2],
        input_price_per_mtok=Decimal("3.0"),
        output_price_per_mtok=Decimal("15.0"),
        quality_coding=0.95,
        quality_reasoning=0.96,
    )


@pytest.fixture
def deepseek_v4() -> ModelSpec:
    """Chinese model — should be excluded by default compliance filter."""
    return ModelSpec(
        id="deepseek-v4",
        name="DeepSeek V4",
        provider="DeepSeek",
        deployment_type=DeploymentType.CLOUD_API,
        parameters_b=None,
        context_window=64000,
        data_residency=DataResidency.CHINA,
        input_price_per_mtok=Decimal("0.14"),
        output_price_per_mtok=Decimal("0.28"),
        quality_coding=0.92,
        quality_reasoning=0.90,
    )


@pytest.fixture
def use_case_coding() -> UseCase:
    return UseCase(
        id="coding-assistant",
        name="Coding Assistant",
        monthly_input_tokens=5_000_000,
        monthly_output_tokens=2_000_000,
        concurrent_users=5,
        max_latency_ms=2000,
    )


# ── Tests ─────────────────────────────────────────────────────────────────────


class TestCloudAPICost:
    def test_basic_cloud_cost(self, claude_sonnet: ModelSpec, use_case_coding: UseCase) -> None:
        engine = TCOEngine()
        result = engine.analyze(
            TCOInput(
                models=[claude_sonnet],
                use_cases=[use_case_coding],
                horizon_months=12,
            )
        )
        assert len(result.strategies) == 1
        strategy = result.strategies[0]

        # 5M input × $3/Mtok + 2M output × $15/Mtok = $15 + $30 = $45/month × 12 = $540
        expected_monthly = Decimal("45.00")
        assert strategy.monthly_cost_avg_usd == expected_monthly
        assert strategy.total_cost_usd == expected_monthly * 12

    def test_cloud_has_no_capex(self, claude_sonnet: ModelSpec, use_case_coding: UseCase) -> None:
        engine = TCOEngine()
        result = engine.analyze(
            TCOInput(models=[claude_sonnet], use_cases=[use_case_coding])
        )
        assert result.strategies[0].capex_usd == Decimal("0")


class TestLocalCost:
    def test_local_fits_hardware(
        self, llama_8b: ModelSpec, rtx_4090: HardwareSpec, use_case_coding: UseCase
    ) -> None:
        engine = TCOEngine()
        result = engine.analyze(
            TCOInput(
                models=[llama_8b],
                hardware=[rtx_4090],
                use_cases=[use_case_coding],
                horizon_months=36,
            )
        )
        assert len(result.strategies) == 1
        strategy = result.strategies[0]
        assert strategy.capex_usd == Decimal("1800")
        assert strategy.opex_total_usd > 0

    def test_local_excluded_when_vram_insufficient(
        self, llama_70b: ModelSpec, rtx_4090: HardwareSpec, use_case_coding: UseCase
    ) -> None:
        # llama_70b requires 40GB VRAM but RTX 4090 only has 24GB
        engine = TCOEngine()
        result = engine.analyze(
            TCOInput(
                models=[llama_70b],
                hardware=[rtx_4090],
                use_cases=[use_case_coding],
            )
        )
        assert len(result.strategies) == 0


class TestComplianceFilter:
    def test_china_model_included_by_default(
        self, deepseek_v4: ModelSpec, use_case_coding: UseCase
    ) -> None:
        """China models are included by default — compliance filter is opt-in."""
        engine = TCOEngine()
        result = engine.analyze(
            TCOInput(models=[deepseek_v4], use_cases=[use_case_coding])
        )
        assert len(result.strategies) == 1
        assert len(result.excluded) == 0

    def test_china_model_excluded_when_filter_enabled(
        self, deepseek_v4: ModelSpec, use_case_coding: UseCase
    ) -> None:
        """China models are excluded only when exclude_china_models=True is explicitly set."""
        engine = TCOEngine()
        result = engine.analyze(
            TCOInput(
                models=[deepseek_v4],
                use_cases=[use_case_coding],
                compliance=ComplianceFilter(exclude_china_models=True),
            )
        )
        assert len(result.strategies) == 0
        assert any("CHINA" in e["reason"] for e in result.excluded)

    def test_residency_filter(
        self, claude_sonnet: ModelSpec, use_case_coding: UseCase
    ) -> None:
        engine = TCOEngine()
        # Only allow EU residency — Claude Sonnet (US) should be excluded
        result = engine.analyze(
            TCOInput(
                models=[claude_sonnet],
                use_cases=[use_case_coding],
                compliance=ComplianceFilter(allowed_residencies=[DataResidency.EU]),
            )
        )
        assert len(result.strategies) == 0
        assert len(result.excluded) == 1


class TestParetoAndRecommendation:
    def test_pareto_and_recommendation_with_mixed_strategies(
        self,
        llama_8b: ModelSpec,
        claude_sonnet: ModelSpec,
        rtx_4090: HardwareSpec,
        use_case_coding: UseCase,
    ) -> None:
        engine = TCOEngine()
        result = engine.analyze(
            TCOInput(
                models=[llama_8b, claude_sonnet],
                hardware=[rtx_4090],
                use_cases=[use_case_coding],
                horizon_months=36,
            )
        )
        assert len(result.strategies) == 2
        assert len(result.pareto_optimal_ids) >= 1
        assert result.recommendation is not None
        assert result.recommendation.strategy is not None
        assert len(result.recommendation.justification) >= 1

    def test_breakeven_calculated_for_local(
        self,
        llama_8b: ModelSpec,
        claude_sonnet: ModelSpec,
        rtx_4090: HardwareSpec,
    ) -> None:
        # High-volume use case: 100M input + 40M output/month
        # Cloud (Sonnet): $300 + $600 = $900/month
        # Local (RTX 4090): ~$102/month OPEX → saves $798/month → break-even ≈ month 3
        high_volume = UseCase(
            id="high-volume",
            name="High Volume Batch",
            monthly_input_tokens=100_000_000,
            monthly_output_tokens=40_000_000,
            concurrent_users=1,
        )
        engine = TCOEngine()
        result = engine.analyze(
            TCOInput(
                models=[llama_8b, claude_sonnet],
                hardware=[rtx_4090],
                use_cases=[high_volume],
                horizon_months=36,
            )
        )
        local = next(s for s in result.strategies if s.hardware_id == "rtx-4090")
        assert local.breakeven_month is not None
        assert 1 <= local.breakeven_month <= 12
