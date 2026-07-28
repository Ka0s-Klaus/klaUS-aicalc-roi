"""Integration tests for the FastAPI REST layer.

Uses TestClient (backed by httpx) — no real server needed.
"""

from decimal import Decimal
from typing import Any

import pytest
from fastapi.testclient import TestClient

from backend.api.app import app

client = TestClient(app)


# ── /health ───────────────────────────────────────────────────────────────────


def test_health_returns_ok() -> None:
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok", "version": "0.1.0"}


# ── GET /v1/models ────────────────────────────────────────────────────────────


def test_list_models_full_catalog() -> None:
    resp = client.get("/v1/models")
    assert resp.status_code == 200
    assert len(resp.json()) == 49


def test_list_models_filter_cloud() -> None:
    resp = client.get("/v1/models?deployment_type=cloud_api")
    assert resp.status_code == 200
    models = resp.json()
    assert len(models) == 24
    assert all(m["deployment_type"] == "cloud_api" for m in models)


def test_list_models_filter_local() -> None:
    resp = client.get("/v1/models?deployment_type=local")
    assert resp.status_code == 200
    models = resp.json()
    assert len(models) == 25
    assert all(m["deployment_type"] == "local" for m in models)


def test_list_models_filter_china_residency() -> None:
    resp = client.get("/v1/models?data_residency=china")
    assert resp.status_code == 200
    models = resp.json()
    assert len(models) == 3
    assert all(m["data_residency"] == "china" for m in models)


def test_list_models_filter_eu_residency() -> None:
    resp = client.get("/v1/models?data_residency=eu")
    assert resp.status_code == 200
    models = resp.json()
    assert len(models) == 3


def test_list_models_combined_filters() -> None:
    resp = client.get("/v1/models?deployment_type=cloud_api&data_residency=us")
    assert resp.status_code == 200
    models = resp.json()
    assert all(m["deployment_type"] == "cloud_api" and m["data_residency"] == "us" for m in models)
    assert len(models) >= 1


def test_list_models_invalid_filter_returns_422() -> None:
    resp = client.get("/v1/models?deployment_type=invalid_type")
    assert resp.status_code == 422


# ── GET /v1/hardware ──────────────────────────────────────────────────────────


def test_list_hardware_full_catalog() -> None:
    resp = client.get("/v1/hardware")
    assert resp.status_code == 200
    assert len(resp.json()) == 20


def test_hardware_entries_have_required_fields() -> None:
    resp = client.get("/v1/hardware")
    for hw in resp.json():
        assert "id" in hw
        assert "vram_gb" in hw
        assert "purchase_price_usd" in hw


# ── GET /v1/hardware/recommend ────────────────────────────────────────────────


def test_recommend_hardware_returns_sorted_options() -> None:
    """Options must be sorted by units_needed ASC then total_price_usd ASC."""
    resp = client.get("/v1/hardware/recommend?min_vram_gb=24")
    assert resp.status_code == 200
    recs = resp.json()
    assert len(recs) > 0
    units = [r["units_needed"] for r in recs]
    assert units == sorted(units), "Results must be sorted by units_needed"


def test_recommend_hardware_single_unit_fits() -> None:
    """For a small VRAM requirement, the top result should need only 1 unit."""
    resp = client.get("/v1/hardware/recommend?min_vram_gb=8")
    assert resp.status_code == 200
    recs = resp.json()
    assert recs[0]["units_needed"] == 1


def test_recommend_hardware_multi_unit_for_large_model() -> None:
    """A 200 GB model must trigger multi-unit recommendations."""
    resp = client.get("/v1/hardware/recommend?min_vram_gb=200")
    assert resp.status_code == 200
    recs = resp.json()
    assert len(recs) > 0
    for r in recs:
        assert r["total_vram_gb"] >= 200, "Each option must provide enough VRAM"
        assert r["units_needed"] <= 8


def test_recommend_hardware_impossible_returns_empty() -> None:
    """No hardware can serve a 10 TB model in ≤8 units — returns empty list."""
    resp = client.get("/v1/hardware/recommend?min_vram_gb=10000")
    assert resp.status_code == 200
    assert resp.json() == []


def test_recommend_hardware_requires_positive_vram() -> None:
    resp = client.get("/v1/hardware/recommend?min_vram_gb=0")
    assert resp.status_code == 422


def test_recommend_hardware_response_shape() -> None:
    resp = client.get("/v1/hardware/recommend?min_vram_gb=16")
    assert resp.status_code == 200
    recs = resp.json()
    assert len(recs) > 0
    first = recs[0]
    assert "hardware" in first
    assert "units_needed" in first
    assert "total_vram_gb" in first
    assert "total_price_usd" in first
    assert isinstance(first["units_needed"], int)
    assert first["units_needed"] >= 1


# ── POST /v1/analyze ──────────────────────────────────────────────────────────


def _cloud_model_payload() -> dict[str, Any]:
    return {
        "models": [
            {
                "id": "claude-sonnet-4-6",
                "name": "Claude Sonnet 4.6",
                "provider": "Anthropic",
                "deployment_type": "cloud_api",
                "context_window": 200000,
                "data_residency": "us",
                "input_price_per_mtok": "3.0",
                "output_price_per_mtok": "15.0",
            }
        ],
        "use_cases": [
            {
                "id": "coding",
                "name": "Coding assistant",
                "monthly_input_tokens": 5_000_000,
                "monthly_output_tokens": 2_000_000,
            }
        ],
        "horizon_months": 12,
    }


def test_analyze_cloud_model_cost() -> None:
    """5M input × $3/Mtok + 2M output × $15/Mtok = $45/month × 12 = $540."""
    resp = client.post("/v1/analyze", json=_cloud_model_payload())
    assert resp.status_code == 200
    result = resp.json()
    assert len(result["strategies"]) == 1
    assert Decimal(result["strategies"][0]["total_cost_usd"]) == Decimal("540")
    assert result["recommendation"] is not None


def test_analyze_missing_body_returns_422() -> None:
    resp = client.post("/v1/analyze", json={})
    assert resp.status_code == 422


def test_analyze_empty_models_returns_422() -> None:
    payload = {
        "models": [],
        "use_cases": [{"id": "t", "name": "T", "monthly_input_tokens": 1000, "monthly_output_tokens": 500}],
    }
    resp = client.post("/v1/analyze", json=payload)
    assert resp.status_code == 422


def test_analyze_china_model_included_by_default() -> None:
    """China models are included by default — compliance filter is opt-in."""
    payload = {
        "models": [
            {
                "id": "deepseek-v3",
                "name": "DeepSeek V3",
                "provider": "DeepSeek",
                "deployment_type": "cloud_api",
                "context_window": 128000,
                "data_residency": "china",
                "input_price_per_mtok": "0.14",
                "output_price_per_mtok": "0.28",
            }
        ],
        "use_cases": [{"id": "t", "name": "T", "monthly_input_tokens": 1_000_000, "monthly_output_tokens": 500_000}],
    }
    resp = client.post("/v1/analyze", json=payload)
    assert resp.status_code == 200
    result = resp.json()
    assert len(result["strategies"]) == 1
    assert len(result["excluded"]) == 0


def test_analyze_china_model_excluded_when_filter_enabled() -> None:
    """China models are excluded only when exclude_china_models=True is explicitly set."""
    payload = {
        "models": [
            {
                "id": "deepseek-v3",
                "name": "DeepSeek V3",
                "provider": "DeepSeek",
                "deployment_type": "cloud_api",
                "context_window": 128000,
                "data_residency": "china",
                "input_price_per_mtok": "0.14",
                "output_price_per_mtok": "0.28",
            }
        ],
        "use_cases": [{"id": "t", "name": "T", "monthly_input_tokens": 1_000_000, "monthly_output_tokens": 500_000}],
        "compliance": {"exclude_china_models": True},
    }
    resp = client.post("/v1/analyze", json=payload)
    assert resp.status_code == 200
    result = resp.json()
    assert len(result["strategies"]) == 0
    assert any("CHINA" in e["reason"] for e in result["excluded"])


def test_analyze_with_real_catalog_data() -> None:
    """Smoke test using real catalog entries fetched from /v1/models and /v1/hardware."""
    claude = next(m for m in client.get("/v1/models").json() if m["id"] == "claude-sonnet-4-6")
    llama = next(m for m in client.get("/v1/models").json() if m["id"] == "llama-3-1-8b-local")
    rtx = next(h for h in client.get("/v1/hardware").json() if h["id"] == "rtx-4090-24gb")

    payload = {
        "models": [claude, llama],
        "hardware": [rtx],
        "use_cases": [
            {
                "id": "test",
                "name": "Integration smoke test",
                "monthly_input_tokens": 10_000_000,
                "monthly_output_tokens": 4_000_000,
            }
        ],
        "horizon_months": 24,
    }
    resp = client.post("/v1/analyze", json=payload)
    assert resp.status_code == 200
    result = resp.json()
    assert len(result["strategies"]) == 2
    assert result["recommendation"] is not None
    assert len(result["pareto_optimal_ids"]) >= 1


@pytest.mark.parametrize("horizon", [1, 12, 36, 120])
def test_analyze_horizon_boundaries(horizon: int) -> None:
    payload = _cloud_model_payload()
    payload["horizon_months"] = horizon
    resp = client.post("/v1/analyze", json=payload)
    assert resp.status_code == 200


def test_analyze_horizon_out_of_range_returns_422() -> None:
    payload = _cloud_model_payload()
    payload["horizon_months"] = 121
    resp = client.post("/v1/analyze", json=payload)
    assert resp.status_code == 422
