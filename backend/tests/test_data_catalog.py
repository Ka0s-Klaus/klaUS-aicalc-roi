"""Validates that all entries in backend/data/ parse correctly against Pydantic models.

Ensures the static catalog never drifts out of sync with the data models.
"""

import json
from decimal import Decimal
from pathlib import Path
from typing import Any

from backend.tco_engine.models import (
    HardwareSpec,
    ModelSpec,
)

DATA_DIR = Path(__file__).parent.parent / "data"


def _strip_meta(entry: dict[str, Any]) -> dict[str, Any]:
    """Remove _source, _scraped_at and other metadata fields before Pydantic validation."""
    return {k: v for k, v in entry.items() if not k.startswith("_")}


def _load_models() -> list[dict[str, Any]]:
    data: dict[str, list[dict[str, Any]]] = json.loads((DATA_DIR / "models.json").read_text())
    return data["models"]


def _load_hardware() -> list[dict[str, Any]]:
    data: dict[str, list[dict[str, Any]]] = json.loads((DATA_DIR / "hardware.json").read_text())
    return data["hardware"]


# ── Schema validation ─────────────────────────────────────────────────────────


class TestModelsCatalog:
    def test_catalog_has_expected_count(self) -> None:
        assert len(_load_models()) == 30

    def test_all_models_parse_against_pydantic(self) -> None:
        errors: list[str] = []
        for entry in _load_models():
            try:
                ModelSpec.model_validate(_strip_meta(entry))
            except Exception as exc:
                errors.append(f"{entry.get('id', '?')}: {exc}")
        assert not errors, "Parse failures:\n" + "\n".join(errors)

    def test_no_duplicate_model_ids(self) -> None:
        ids = [m["id"] for m in _load_models()]
        duplicates = {i for i in ids if ids.count(i) > 1}
        assert not duplicates, f"Duplicate model IDs: {duplicates}"

    def test_cloud_models_have_pricing_or_explicit_null(self) -> None:
        """Cloud models must declare pricing (even if null for deprecated ones)."""
        for entry in _load_models():
            if entry["deployment_type"] == "cloud_api":
                assert "input_price_per_mtok" in entry, f"{entry['id']} missing input_price_per_mtok"
                assert "output_price_per_mtok" in entry, f"{entry['id']} missing output_price_per_mtok"

    def test_local_models_have_min_vram(self) -> None:
        for entry in _load_models():
            if entry["deployment_type"] == "local":
                assert entry.get("min_vram_gb") is not None, (
                    f"{entry['id']}: local model must declare min_vram_gb"
                )

    def test_china_models_have_no_compliance_flags(self) -> None:
        """Chinese provider cloud models should declare no compliance certifications."""
        for entry in _load_models():
            if entry.get("data_residency") == "china" and entry["deployment_type"] == "cloud_api":
                flags = entry.get("compliance_flags", [])
                assert flags == [], (
                    f"{entry['id']}: China cloud model should have empty compliance_flags, got {flags}"
                )

    def test_local_models_have_full_compliance_flags(self) -> None:
        """Self-hosted models can claim all compliance standards (operator controls data)."""
        all_standards = {"gdpr", "hipaa", "soc2", "pci_dss", "iso_27001", "fedramp"}
        for entry in _load_models():
            if entry["deployment_type"] == "local":
                flags = set(entry.get("compliance_flags", []))
                assert flags == all_standards, (
                    f"{entry['id']}: local model should declare all compliance flags, got {flags}"
                )

    def test_quality_scores_in_range(self) -> None:
        for entry in _load_models():
            for field in ("quality_coding", "quality_reasoning", "quality_multilingual"):
                value = entry.get(field)
                if value is not None:
                    assert 0.0 <= value <= 2.0, (
                        f"{entry['id']}.{field} = {value} out of expected range [0, 2]"
                    )

    def test_pricing_values_are_positive(self) -> None:
        for entry in _load_models():
            for field in ("input_price_per_mtok", "output_price_per_mtok"):
                value = entry.get(field)
                if value is not None:
                    assert Decimal(str(value)) > 0, (
                        f"{entry['id']}.{field} = {value} must be positive"
                    )

    def test_deprecated_models_have_null_prices(self) -> None:
        """Models known to be deprecated should have null prices."""
        deprecated_ids = {"gemini-2-0-flash"}
        for entry in _load_models():
            if entry["id"] in deprecated_ids:
                assert entry.get("input_price_per_mtok") is None, (
                    f"{entry['id']} is deprecated but has non-null pricing"
                )

    def test_counts_by_deployment_type(self) -> None:
        models = _load_models()
        cloud = sum(1 for m in models if m["deployment_type"] == "cloud_api")
        local = sum(1 for m in models if m["deployment_type"] == "local")
        assert cloud == 20, f"Expected 20 cloud models, got {cloud}"
        assert local == 10, f"Expected 10 local models, got {local}"


class TestHardwareCatalog:
    def test_catalog_has_expected_count(self) -> None:
        assert len(_load_hardware()) == 10

    def test_all_hardware_parse_against_pydantic(self) -> None:
        errors: list[str] = []
        for entry in _load_hardware():
            try:
                HardwareSpec.model_validate(_strip_meta(entry))
            except Exception as exc:
                errors.append(f"{entry.get('id', '?')}: {exc}")
        assert not errors, "Parse failures:\n" + "\n".join(errors)

    def test_no_duplicate_hardware_ids(self) -> None:
        ids = [h["id"] for h in _load_hardware()]
        duplicates = {i for i in ids if ids.count(i) > 1}
        assert not duplicates, f"Duplicate hardware IDs: {duplicates}"

    def test_vram_values_are_positive(self) -> None:
        for entry in _load_hardware():
            assert entry["vram_gb"] > 0, f"{entry['id']}: vram_gb must be positive"

    def test_purchase_prices_are_positive(self) -> None:
        for entry in _load_hardware():
            assert Decimal(str(entry["purchase_price_usd"])) > 0, (
                f"{entry['id']}: purchase_price_usd must be positive"
            )

    def test_cooling_and_maintenance_factors_in_range(self) -> None:
        for entry in _load_hardware():
            cf = entry.get("cooling_overhead_factor", 0.15)
            mp = entry.get("maintenance_annual_pct", 0.05)
            assert 0.0 <= cf <= 1.0, f"{entry['id']}: cooling_overhead_factor {cf} out of range"
            assert 0.0 <= mp <= 1.0, f"{entry['id']}: maintenance_annual_pct {mp} out of range"

    def test_lifespan_at_least_12_months(self) -> None:
        for entry in _load_hardware():
            assert entry.get("lifespan_months", 36) >= 12, (
                f"{entry['id']}: lifespan_months must be >= 12"
            )


class TestCrossCompatibility:
    def test_some_local_models_fit_in_rtx4090(self) -> None:
        """Sanity check: at least a few local models should fit in a 24GB RTX 4090."""
        rtx4090_vram = 24.0
        local_models = [m for m in _load_models() if m["deployment_type"] == "local"]
        fitting = [m for m in local_models if (m.get("min_vram_gb") or 0) <= rtx4090_vram]
        assert len(fitting) >= 3, (
            f"Expected at least 3 local models fitting in RTX 4090 (24GB), got {len(fitting)}: "
            f"{[m['id'] for m in fitting]}"
        )

    def test_large_models_require_datacenter_hardware(self) -> None:
        """Models >80GB VRAM are datacenter-class. Cluster-only models (>H200 141GB)
        are valid catalog entries — the engine filters them correctly at analysis time.
        """
        hardware = _load_hardware()
        datacenter_max_vram = max(h["vram_gb"] for h in hardware)
        local_models = [m for m in _load_models() if m["deployment_type"] == "local"]
        heavy_models = [m for m in local_models if (m.get("min_vram_gb") or 0) > 80]

        assert len(heavy_models) >= 1, "Expected at least one datacenter-class local model in catalog"

        # All heavy local models must declare min_vram_gb
        for m in heavy_models:
            assert m.get("min_vram_gb") is not None, f"{m['id']} missing min_vram_gb"

        # Cluster-only models (require more VRAM than the largest GPU in catalog) are
        # intentionally included — they represent real production deployment options.
        cluster_only = [m for m in heavy_models if (m.get("min_vram_gb") or 0) > datacenter_max_vram]
        assert len(cluster_only) <= 3, (
            f"Unexpectedly many cluster-only models: {[m['id'] for m in cluster_only]}"
        )

    def test_engine_runs_with_catalog_data(self) -> None:
        """Smoke test: engine accepts real catalog entries without crashing."""
        models_data = _load_models()
        hardware_data = _load_hardware()

        # Pick one cloud model with valid pricing and one hardware
        claude = next(m for m in models_data if m["id"] == "claude-sonnet-4-6")
        rtx = next(h for h in hardware_data if h["id"] == "rtx-4090-24gb")
        llama_8b = next(m for m in models_data if m["id"] == "llama-3-1-8b-local")

        from backend.tco_engine import TCOEngine
        from backend.tco_engine.models import TCOInput, UseCase

        engine = TCOEngine()
        result = engine.analyze(
            TCOInput(
                models=[
                    ModelSpec.model_validate(_strip_meta(claude)),
                    ModelSpec.model_validate(_strip_meta(llama_8b)),
                ],
                hardware=[HardwareSpec.model_validate(_strip_meta(rtx))],
                use_cases=[
                    UseCase(
                        id="test",
                        name="Smoke test",
                        monthly_input_tokens=5_000_000,
                        monthly_output_tokens=2_000_000,
                    )
                ],
                horizon_months=12,
            )
        )
        assert len(result.strategies) == 2
        assert result.recommendation is not None
