# 📦 Catálogo de datos estáticos — klaUS-aicalc-roi

## Contenido

| Fichero | Descripción | Entradas |
| --- | --- | --- |
| `models.json` | Especificaciones y precios de modelos AI | 30 |
| `hardware.json` | Configuraciones de hardware GPU/APU | 10 |

## 🔍 Fuentes consultadas (julio 2026)

### Precios API de modelos
| Proveedor | Fuente oficial |
| --- | --- |
| Anthropic | anthropic.com/pricing |
| OpenAI | openai.com/api/pricing |
| Google | ai.google.dev/pricing |
| Mistral AI | mistral.ai/pricing/api |
| Cohere | cohere.com/pricing |
| xAI | x.ai/api |
| DeepSeek | platform.deepseek.com/api-docs/pricing |
| Groq | groq.com/pricing |
| Together AI | api.together.ai/pricing |
| Alibaba Cloud | DashScope / deepinfra.com (aproximado) |

### Benchmarks de calidad
- **LMSys Chatbot Arena** — Elo rating (swfte.com/lmsys-leaderboard jul-2026)
- **HumanEval** — benchmark de coding
- **MMLU / MMLU-Pro** — benchmark de razonamiento
- **SWE-bench Verified** — tasks de software engineering reales

### Specs y precios hardware
- **TechPowerUp GPU Database** — TDP y specs técnicos
- **gpucost.org** — precios de mercado GPU
- **bestvaluegpu.com** — historial de precios nuevos/usados
- **intuitionlabs.ai** — precios datacenter (A100, H100, H200)
- **Apple Store** — Mac Studio precios oficiales

---

## ⚠️ Correcciones respecto al enunciado original (jul-2026)

| Item original | Corrección | Motivo |
| --- | --- | --- |
| Mistral Large 2 | → **Mistral Large 3** ($0.50/$1.50) | Large 2 retirado del API |
| Mistral Small 3.1 | → **Mistral Small 4** ($0.10/$0.30) | Retirado noviembre 2025 |
| Gemini 2.0 Flash | Precios `null` (deprecado) | Cerrado 1-jun-2026 |
| Mac Studio M4 Ultra 192GB | → **Mac Studio M3 Ultra 96GB** ($5,299) | M4 Ultra 192GB nunca existió |
| Llama 4 Maverick 17B×16E | → **17B×128 expertos** (400B total) | Arquitectura real según Hugging Face |

---

## 🔄 Política de actualización

Los precios de los proveedores cloud cambian frecuentemente. Actualizar este catálogo:

1. **Trimestral** — revisar todas las páginas de pricing
2. **Al detectar cambio significativo** (>20% en un modelo relevante)
3. **Al añadir un nuevo modelo o proveedor**

Al actualizar:
- Cambiar `catalog_version` con la fecha ISO
- Actualizar `_scraped_at` en cada entrada modificada
- Añadir nota en el PR describiendo qué cambió y por qué

---

## 🏗️ Uso en el engine

```python
import json
from pathlib import Path
from backend.tco_engine.models import ModelSpec, HardwareSpec

def load_models() -> list[ModelSpec]:
    data = json.loads((Path(__file__).parent / "models.json").read_text())
    return [
        ModelSpec.model_validate({k: v for k, v in m.items() if not k.startswith("_")})
        for m in data["models"]
    ]

def load_hardware() -> list[HardwareSpec]:
    data = json.loads((Path(__file__).parent / "hardware.json").read_text())
    return [
        HardwareSpec.model_validate({k: v for k, v in h.items() if not k.startswith("_")})
        for h in data["hardware"]
    ]
```

Los campos con prefijo `_` (`_source`, `_scraped_at`) son metadatos de auditoría — se eliminan antes de la validación Pydantic.
