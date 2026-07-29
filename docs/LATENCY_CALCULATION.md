# Latency Calculation in klaUS-aicalc-roi

## Overview

The system estimates **Time-to-First-Token (TTFT)** latency for local inference deployments. TTFT is critical for user experience—it determines how quickly a user sees the first token of a response after sending a prompt.

## Formula

```
TTFT (ms) = generation_time × queue_factor × precision_adjustment
```

### Component 1: Generation Time

```
generation_time = (avg_output_tokens / effective_tps) × 1000
```

Where:
- `avg_output_tokens` = 256 tokens (empirical average for first response chunk)
- `effective_tps` = model's tokens/sec throughput × precision speedup factor

### Component 2: Queue Factor

```
queue_factor = max(1.0, concurrent_users / gpu_kv_capacity)
```

Where:
- `gpu_kv_capacity` = hardware.quantity × 2
  - Each GPU can comfortably hold ~2 concurrent users' KV cache
- If concurrent_users > capacity, linearly increases latency

### Component 3: Precision Throughput Adjustment

Modern GPUs (H100/A100) have special instruction sets (Tensor Engine) for low-precision arithmetic:

```
precision_factor = {
  "FP16": 1.0,   # baseline (2 bytes per element, standard precision)
  "FP8": 1.5,    # 50% faster (1 byte per element, NVIDIA's fp8 support)
  "INT4": 2.0    # 2x faster (0.5 bytes per element, maximum quantization)
}
```

## Examples

### Example 1: Llama 70B, 4 concurrent users, FP16

Assumptions:
- `tokens_per_second_fp16`: 15.5 tps
- `hardware.quantity`: 1 (single H100)
- `concurrent_users`: 4

Calculation:
```
generation_time = (256 / 15.5) × 1000 = 16,516 ms

queue_factor = max(1.0, 4 / (1 × 2)) = 2.0

TTFT = 16,516 × 2.0 × 1.0 = 33,032 ms ≈ 33 seconds
```

**Interpretation**: With only 1 GPU and 4 concurrent users, the queue builds up significantly. Each user waits ~2x longer due to resource contention.

### Example 2: Same Setup but 2 H100s with FP8

Assumptions:
- `tokens_per_second_fp16`: 15.5 tps
- `hardware.quantity`: 2 (two H100s)
- `concurrent_users`: 4
- `precision`: FP8

Calculation:
```
effective_tps = 15.5 × 1.5 = 23.25 tps

generation_time = (256 / 23.25) × 1000 = 11,005 ms

queue_factor = max(1.0, 4 / (2 × 2)) = 1.0

TTFT = 11,005 × 1.0 × 1.0 = 11,005 ms ≈ 11 seconds
```

**Interpretation**: With 2 GPUs and FP8 precision, no queue forms (4 users fit exactly), and throughput boost cuts latency by ~40%.

### Example 3: DeepSeek 7B, 16 concurrent users, INT4

Assumptions:
- `tokens_per_second_fp16`: 80 tps (smaller model, higher throughput)
- `hardware.quantity`: 2 H100s
- `concurrent_users`: 16
- `precision`: INT4

Calculation:
```
effective_tps = 80 × 2.0 = 160 tps

generation_time = (256 / 160) × 1000 = 1,600 ms

queue_factor = max(1.0, 16 / (2 × 2)) = 4.0

TTFT = 1,600 × 4.0 × 1.0 = 6,400 ms ≈ 6.4 seconds
```

**Interpretation**: Smaller model + quantization gives low baseline latency, but high concurrency still causes queueing. Need more GPUs or fewer concurrent users for sub-2-second TTFT.

## Latency SLO (Service Level Objective) Guidance

Based on industry standards:

| SLO | Use Case | Latency Target |
|-----|----------|----------------|
| **Tier 1** | Real-time chat/coding | <500 ms |
| **Tier 2** | High-responsiveness | 500 ms - 2 sec |
| **Tier 3** | Batch-friendly | 2-5 sec |
| **Tier 4** | Background/async | >5 sec |

### Achieving Sub-1 Second TTFT

Rules of thumb:
1. **Small model**: 7B is ~5x faster than 70B for same GPU
2. **Low precision**: INT4 is 2x faster than FP16
3. **Few concurrent users**: Keep queue_factor ≈ 1.0
4. **Multi-GPU**: Each GPU adds ~2 concurrent slots

Example configuration for <500ms:
- Model: DeepSeek-7B (80 tps in FP16)
- Precision: INT4 (160 tps effective)
- Hardware: 2× H100
- Concurrent users: 4 (queue_factor = 1.0)
- TTFT ≈ 1.6 × 1.0 × 1.0 = **1.6 seconds** ❌ Still too high

To reach <500ms, you'd need:
- 3× GPUs → queue_factor stays 1.0
- TTFT ≈ 1.6 / (token throughput ratio) ≈ 800ms still slow...

**Better**: Serve fewer concurrent users:
- Model: DeepSeek-7B
- Precision: INT4 (160 tps)
- Hardware: 1× H100
- Concurrent users: 1
- TTFT ≈ **1.6 seconds** (generation-bound, not queue-bound)

The fundamental bottleneck is prefill latency. Even at 160 tps, prefilling 256 output tokens takes ~1.6 seconds. For <500ms, use speculative decoding or smaller contexts.

## Implementation Notes

The latency calculation in `backend/tco_engine/calculators.py` function `_estimate_local_latency()` applies:
- Model throughput from catalog
- Precision adjustments from use case
- Concurrent user load from queue factor

This is a **rough estimate** and actual latency depends on:
- Model architecture (some architectures are faster per parameter)
- GPU memory bandwidth (affects prefill throughput)
- Batch size scheduling (vLLM's continuous batching)
- Network roundtrip time (if remote inference)

## References

- **TTFT Definition**: Time elapsed from sending a prompt to receiving the first output token
- **Prefill Phase**: Processing the entire input prompt (slow, O(N) tokens)
- **Decode Phase**: Generating each output token one at a time (fast, O(1) per token)
- **vLLM Docs**: https://docs.vllm.ai/
- **NVIDIA Latency Optimization**: https://developer.nvidia.com/blog/...

