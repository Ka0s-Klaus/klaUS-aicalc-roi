# Hardware Dimensioning Algorithm for LLM Inference

## Overview

The klaUS-aicalc-roi system calculates GPU requirements for local LLM inference using a sophisticated model that considers:

1. **Model Weights VRAM**: Space needed to load the model parameters
2. **KV Cache Requirements**: Memory for key-value cache across concurrent users
3. **Inference Precision**: FP16, FP8, or INT4 quantization
4. **Concurrency Profile**: Number of concurrent users and context window size

## Dimensioning Formula

### Step 1: Model Weights VRAM
```
units_for_model = ceil(model.min_vram_gb / gpu.vram_gb)
```

This ensures the GPU has enough memory to load the model parameters.

### Step 2: KV Cache Per User

The KV cache requirement is the dominant factor in concurrent inference dimensioning. Based on the mathematical model from NVIDIA and vLLM:

```
KV_cache_per_user_gb = (model_params_billions / 1000) 
                       × context_window_tokens 
                       × precision_factor 
                       × 0.000122
```

Where:
- **model_params_billions**: Model size (e.g., 7B, 13B, 70B)
- **context_window_tokens**: Average context length expected (e.g., 4096, 32768, 128000)
- **precision_factor**: 
  - FP16: 1.0 (baseline, 2 bytes per element)
  - FP8: 0.5 (1 byte per element)
  - INT4: 0.25 (0.5 bytes per element)
- **0.000122**: Empirical scaling constant derived from industry KV cache studies

### Step 3: KV Cache for All Concurrent Users

```
total_kv_cache_needed = KV_cache_per_user_gb × concurrent_users
```

### Step 4: Available VRAM Per GPU

After loading the model, calculate remaining memory for KV cache:

```
available_vram_per_gpu = gpu.vram_gb - (model.min_vram_gb / units_for_model)
```

### Step 5: Units Needed for Concurrency

```
units_for_kv = ceil(total_kv_cache_needed / available_vram_per_gpu)
```

### Step 6: Final Recommendation

```
units_needed = max(units_for_model, units_for_kv)
units_needed = max(units_needed, 1)  # At least 1 unit
```

## Examples

### Example 1: Llama 2 70B, 8 Concurrent Users, 4K Context, FP16

- Model params: 70B
- min_vram_gb: 140 (70B × 2 bytes for FP16)
- Context: 4096 tokens
- Precision: FP16 (factor 1.0)

KV cache per user:
```
= (70 / 1000) × 4096 × 1.0 × 0.000122
= 0.07 × 4096 × 0.000122
≈ 0.035 GB per user
```

Total KV cache needed:
```
= 0.035 × 8 concurrent users
= 0.28 GB
```

For an H100 (80GB):
- Units for model: ceil(140 / 80) = 2 units
- Available per GPU: 80 - (140/2) = 10 GB
- Units for KV: ceil(0.28 / 10) = 1 unit
- **Result: 2 units (H100 SXM)**

### Example 2: Llama 2 70B, 8 Concurrent Users, 128K Context, FP8

- Model params: 70B
- min_vram_gb: 70 (70B × 1 byte for FP8)
- Context: 131072 tokens
- Precision: FP8 (factor 0.5)

KV cache per user:
```
= (70 / 1000) × 131072 × 0.5 × 0.000122
= 0.07 × 131072 × 0.5 × 0.000122
≈ 0.56 GB per user
```

Total KV cache needed:
```
= 0.56 × 8 concurrent users
= 4.48 GB
```

For an H100 (80GB):
- Units for model: ceil(70 / 80) = 1 unit
- Available per GPU: 80 - 70 = 10 GB
- Units for KV: ceil(4.48 / 10) = 1 unit
- **Result: 1 unit (H100 SXM)**

### Example 3: Llama 2 70B, 32 Concurrent Users, 128K Context, FP8

KV cache per user: ≈ 0.56 GB (same as above)

Total KV cache needed:
```
= 0.56 × 32 concurrent users
= 17.92 GB
```

For an H100 (80GB):
- Units for model: ceil(70 / 80) = 1 unit
- Available per GPU: 80 - 70 = 10 GB
- Units for KV: ceil(17.92 / 10) = 2 units
- **Result: 2 units (H100 SXM)**

## Key Assumptions

1. **Quantization Reduces VRAM Linearly**: FP8 uses half the VRAM of FP16, INT4 uses a quarter
2. **KV Cache Scales with Model Size and Context**: Larger models and longer contexts require exponentially more KV cache
3. **Concurrent Users Are Additive**: Each concurrent user requires their own KV cache space
4. **GPU Overprovisioning Is Healthy**: Actual deployments often use 70-80% GPU memory utilization for safety margins

## Configuration Parameters

Users can customize:

| Parameter | Type | Default | Range | Description |
|-----------|------|---------|-------|-------------|
| `concurrent_users` | int | 1 | 1-1000 | Number of simultaneous inference requests |
| `total_users` | int | 1 | 1-100000 | Total unique users (for business metrics) |
| `precision` | enum | FP16 | FP16/FP8/INT4 | Inference precision (affects VRAM and throughput) |
| `context_window_tokens` | int | 4096 | 512-131072 | Average context length expected |

## API Endpoint

```
GET /v1/hardware/recommend
  ?min_vram_gb=140
  &concurrent_users=8
  &precision=FP16
  &context_window_tokens=4096
  &model_params_billions=70
```

Returns a list of hardware options sorted by `(units_needed, total_price)`.

## Scientific References

- **KV Cache Formula**: 2 × L × H_kv × D × S × bytes_per_element
  - L: number of layers
  - H_kv: KV attention heads
  - D: head dimension
  - S: sequence length
  
- **Industry Data**:
  - NVIDIA H100/A100 inference serving benchmarks
  - vLLM continuous batching studies
  - Meta Llama inference recommendations
  - Groq inference optimization papers

## Future Enhancements

1. **Tensor Parallelism**: Multi-GPU model sharding to reduce per-GPU VRAM needs
2. **KV Cache Quantization**: 4-bit KV caches to further reduce memory
3. **Dynamic Batching**: Variable batch sizes based on latency SLAs
4. **Speculative Decoding**: Reduce tokens per request for faster inference
