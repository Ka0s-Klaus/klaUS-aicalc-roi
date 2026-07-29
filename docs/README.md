# klaUS-aicalc-roi Documentation

This directory contains comprehensive documentation for the klaUS-aicalc-roi TCO calculator, with a focus on the sophisticated hardware dimensioning algorithm introduced in v2.0.

## 📚 Quick Navigation

### Core Concepts

- **[HARDWARE_DIMENSIONING.md](HARDWARE_DIMENSIONING.md)** — The mathematical foundation
  - KV cache formula derivation
  - Concurrent user calculations
  - Precision impact (FP16 vs FP8 vs INT4)
  - Real-world examples
  - Industry references

- **[LATENCY_CALCULATION.md](LATENCY_CALCULATION.md)** — Performance estimation
  - Time-to-first-token (TTFT) formula
  - Queue factor calculations
  - Precision throughput adjustments
  - SLO guidance (sub-500ms, sub-2sec targets)
  - Latency examples by model size

### API Reference

- **[API.md](API.md)** — RESTful endpoint documentation
  - `/v1/hardware/recommend` — Advanced hardware recommendation
  - Parameter definitions and examples
  - Precision impact table
  - Error handling

### Change History

- **[CHANGELOG_HARDWARE_DIMENSIONING.md](CHANGELOG_HARDWARE_DIMENSIONING.md)** — v2.0 update details
  - Before/after behavior
  - Breaking changes (none!)
  - Migration guide
  - Testing recommendations

---

## 🎯 What's New in v2.0?

### The Problem

**Before**: Hardware sizing was naive:
- "Llama 70B needs 140 GB VRAM, so use 2× H100"
- Fixed ratio: 1 GPU per 2 concurrent users
- No consideration of model size, precision, or context length

**Real-world impact**: Grossly over-provisioned hardware for small models, under-provisioned for high concurrency.

### The Solution

**Now**: Sophisticated dimensioning based on KV cache requirements:

```
KV_cache_per_user = (model_params_billions / 1000) 
                   × context_window_tokens 
                   × precision_factor 
                   × 0.000122 GB

total_vram_needed = model_weights + (KV_cache_per_user × concurrent_users)

units_needed = ceil(total_vram_needed / gpu_memory)
```

### Real Impact

**Scenario**: DeepSeek 7B, 16 concurrent users, 4K context

| Precision | Model VRAM | KV Cache | Total | H100s | Cost |
|-----------|-----------|----------|-------|-------|------|
| FP16 | 14 GB | 0.54 GB | 8.64 GB | 1 | $40K |
| FP8 | 7 GB | 0.27 GB | 4.27 GB | 1 | $40K |
| INT4 | 3.5 GB | 0.14 GB | 2.24 GB | 1 | $40K |

**Same hardware, 3.8× better cost-per-inference** by using INT4!

---

## 🔧 Configuration Parameters

Users can now customize:

| Parameter | Type | Default | Range | Impact |
|-----------|------|---------|-------|--------|
| `concurrent_users` | int | 1 | 1-1000 | Hardware units needed |
| `total_users` | int | 1 | 1-100K | Business metrics |
| `precision` | enum | FP16 | FP16/FP8/INT4 | VRAM & throughput |
| `context_window_tokens` | int | 4096 | 512-128K | KV cache size |

---

## 💡 Key Insights

### 1. Precision Scales Linearly with VRAM
- INT4 = 25% of FP16 VRAM
- FP8 = 50% of FP16 VRAM

### 2. KV Cache Dominates at Scale
- Single user: model weights >> KV cache
- 32 concurrent users: KV cache can exceed model weights
- 100+ concurrent users: Need multi-GPU for KV cache alone

### 3. Context Window Is Exponential
- 4K context: 0.035 GB per user (Llama 70B, FP16)
- 32K context: 0.28 GB per user (8× larger)
- 128K context: 1.12 GB per user (32× larger)

### 4. Model Size Matters
- Llama 70B: ~1.9 GB per user per 32K tokens
- DeepSeek 7B: ~0.2 GB per user per 32K tokens
- Small 3B model: ~0.08 GB per user per 32K tokens

---

## 📊 Hardware Recommendation Examples

### Example 1: Development Setup
**Llama 2 7B, 2 concurrent users, 4K context, FP16**
- Model: 14 GB
- KV cache: 0.07 GB
- **Recommendation**: 1× RTX 4090 (24 GB) ✓

### Example 2: Production Multi-User
**Llama 2 70B, 16 concurrent users, 32K context, FP8**
- Model: 70 GB
- KV cache: 4.48 GB
- **Recommendation**: 2× H100 (160 GB) ✓

### Example 3: High-Concurrency API
**DeepSeek 7B, 100 concurrent users, 4K context, INT4**
- Model: 3.5 GB
- KV cache: 1.4 GB
- **Recommendation**: 1-2× H100 depending on safety margin

---

## 🧪 Testing Your Setup

To verify hardware sizing:

1. **Get your model specs** from the `/v1/models` endpoint
2. **Calculate using the formula** (see HARDWARE_DIMENSIONING.md)
3. **Get recommendation** from `/v1/hardware/recommend`
4. **Cross-check** with actual vLLM deployment

Example validation:
```bash
# Your config
MODEL_PARAMS=70B
CONTEXT=32768
USERS=8
PRECISION=FP8

# Calculate expected KV cache
# = (70 / 1000) × 32768 × 0.5 × 0.000122
# ≈ 0.14 GB per user

# Expected total
# = 70 GB (model) + (0.14 × 8) = 71.12 GB
# → Fits in 1× H100 with margin ✓
```

---

## 🚀 Next Steps

1. **For Users**: Read [HARDWARE_DIMENSIONING.md](HARDWARE_DIMENSIONING.md) for sizing guidance
2. **For Developers**: Check [API.md](API.md) for endpoint details
3. **For Operators**: See [LATENCY_CALCULATION.md](LATENCY_CALCULATION.md) for SLO planning
4. **For Contributors**: Review [CHANGELOG_HARDWARE_DIMENSIONING.md](CHANGELOG_HARDWARE_DIMENSIONING.md) for implementation details

---

## 📖 Scientific References

- **KV Cache Formula**: 2 × L × H_kv × D × S × bytes_per_element
- **vLLM Papers**: https://arxiv.org/abs/2309.06180
- **NVIDIA Inference Docs**: https://developer.nvidia.com/blog/...
- **Meta Llama Optimization**: https://llama.meta.com/docs/model-architecture/

---

## 📞 Questions?

- **API Questions**: See [API.md](API.md)
- **Dimensioning Questions**: See [HARDWARE_DIMENSIONING.md](HARDWARE_DIMENSIONING.md)
- **Latency Questions**: See [LATENCY_CALCULATION.md](LATENCY_CALCULATION.md)
- **Implementation Details**: See [CHANGELOG_HARDWARE_DIMENSIONING.md](CHANGELOG_HARDWARE_DIMENSIONING.md)

