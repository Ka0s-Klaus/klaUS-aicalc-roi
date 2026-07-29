# klaUS-aicalc-roi API Documentation

## Overview

The klaUS-aicalc-roi API provides TCO (Total Cost of Ownership) analysis for AI infrastructure decisions, including model catalogs, hardware recommendations, and cost calculations.

## Base URL

```
http://localhost:8000
```

Set `NEXT_PUBLIC_API_URL` environment variable to override.

---

## Endpoints

### 1. Hardware Recommendation (Advanced)

**GET** `/v1/hardware/recommend`

Recommends hardware options for running a model with specified concurrency and precision.

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `min_vram_gb` | float | ✓ | Model weight VRAM requirement in GB |
| `concurrent_users` | int | optional | Number of concurrent inference requests (default: 1) |
| `precision` | string | optional | Inference precision: `FP16`, `FP8`, `INT4` (default: `FP16`) |
| `context_window_tokens` | int | optional | Average context length in tokens (default: 4096, range: 512-131072) |
| `model_params_billions` | float | optional | Model size in billions for improved KV cache calculation |

#### Dimensioning Logic

The endpoint calculates hardware requirements using the sophisticated formula documented in [HARDWARE_DIMENSIONING.md](HARDWARE_DIMENSIONING.md):

```
total_units_needed = max(
  ceil(model_vram / gpu_vram),                    # Model weights
  ceil(kv_cache_for_all_users / available_vram)  # Concurrency
)
```

Where KV cache per user is estimated as:
```
KV_cache_per_user = (model_params_B / 1000) 
                   × context_tokens 
                   × precision_factor 
                   × 0.000122 GB
```

#### Response

```json
[
  {
    "hardware": {
      "id": "h100-80gb",
      "name": "NVIDIA H100 80GB SXM",
      "vram_gb": 80,
      "tdp_watts": 700,
      "purchase_price_usd": "40000",
      "quantity": 1
    },
    "units_needed": 2,
    "total_vram_gb": 160,
    "total_price_usd": "80000"
  }
]
```

#### Examples

**Example 1: Llama 70B, 8 concurrent users, FP16, 4K context**

```
GET /v1/hardware/recommend
  ?min_vram_gb=140
  &concurrent_users=8
  &precision=FP16
  &context_window_tokens=4096
  &model_params_billions=70
```

**Example 2: DeepSeek 7B, 32 concurrent users, INT4, 32K context**

```
GET /v1/hardware/recommend
  ?min_vram_gb=7
  &concurrent_users=32
  &precision=INT4
  &context_window_tokens=32768
  &model_params_billions=7
```

---

## Precision Impact on Hardware Sizing

| Precision | Bytes per Token | VRAM Reduction | Throughput Boost |
|-----------|-----------------|----------------|------------------|
| FP16 | 2 bytes | baseline | 1.0x |
| FP8 | 1 byte | -50% | 1.5x |
| INT4 | 0.5 bytes | -75% | 2.0x |

Example: Llama 70B at 8 concurrent users, 128K context
- **FP16**: 2 H100s (40 GB KV cache needed)
- **FP8**: 1-2 H100s (20 GB KV cache needed)
- **INT4**: 1 H100 (10 GB KV cache needed)

---

## Error Handling

All endpoints return HTTP error codes with descriptive messages:

```json
{
  "detail": "Model parameters must be positive"
}
```

Common codes:
- **400**: Bad request (invalid parameters)
- **422**: Validation error (e.g., min_vram_gb <= 0)
- **500**: Server error
