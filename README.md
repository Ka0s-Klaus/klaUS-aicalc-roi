# 🧮 klaUS-aicalc-roi

> **The only comprehensive TCO calculator for AI infrastructure decisions.**

## 🤔 ¿Qué hago? ¿Cómo lo hago? ¿Y para qué lo hago?

**Qué hago:** Calculo el TCO (Total Cost of Ownership) real de cualquier combinación de modelos de IA × hardware × proveedores cloud para tu carga de trabajo específica. No estimaciones genéricas — análisis multi-dimensional con precios en tiempo real.

**Cómo lo hago:** Un motor de cálculo en Python modela CAPEX, OPEX, costes de API, latencia, calidad de benchmarks y compliance. Aplica el algoritmo de Pareto Frontier para identificar las combinaciones óptimas y genera una recomendación automática con análisis de sensibilidad.

**Para qué lo hago:** Las decisiones de infraestructura de IA se toman hoy en spreadsheets manuales con datos obsoletos y cobertura parcial. klaUS-aicalc-roi es la fuente única de verdad para que cualquier CTO, startup o equipo de MLOps tome la decisión correcta en minutos, no en semanas.

---

## 🎯 El problema

| Herramienta actual | Limitación |
| --- | --- |
| Dashboards de cloud (AWS/GCP/Azure) | Solo su propio stack |
| HuggingFace | Benchmarks pero sin TCO |
| Spreadsheets manuales | Obsoletos en 3 meses, error-prone |
| Consultoras | $50K+ por análisis |

**Resultado:** CTOs gastan 100+ horas en análisis que ignoran el 80% del mercado.

---

## ✨ Qué hace

- ✅ **Todos los modelos** — locales (Llama 4, Qwen, DeepSeek, Mistral, Phi) + cloud APIs (OpenAI, Anthropic, Google, AWS Bedrock...)
- ✅ **Todo el hardware** — consumer (RTX 4090, M3 Ultra), datacenter (H100, A100), cloud GPU rental (RunPod, Lambda Labs, Vast AI)
- ✅ **Análisis N-dimensional** — coste, latencia, calidad de benchmarks, compliance, escalabilidad
- ✅ **Recomendación automática** — Pareto Frontier + motor de scoring
- ✅ **Análisis de sensibilidad** — ¿qué pasa si el precio de electricidad sube 30%? ¿si el uso crece 2x?
- ✅ **Compliance-aware** — GDPR, HIPAA, SOC2, FedRAMP, filtro de soberanía de datos

---

## 🏗️ Arquitectura

```
klaUS-aicalc-roi/
├── backend/
│   ├── tco_engine/     # 🧠 Motor de cálculo TCO (librería Python pura)
│   │   ├── models.py   # Data structures: input/output del engine
│   │   ├── calculators.py  # CAPEX, OPEX, API cost, latency, quality
│   │   └── engine.py   # Orchestrator: combinator → calculators → Pareto → recommendation
│   ├── api/            # FastAPI REST (Fase 2)
│   └── tests/
├── frontend/           # Next.js 15 + TypeScript (Fase 2)
├── docs/               # Documentación por componente
└── .github/workflows/  # CI/CD
```

**Stack:**
- Engine: Python 3.12 + Pydantic v2
- API: FastAPI + Uvicorn (Fase 2)
- Frontend: Next.js 15 + TypeScript + TailwindCSS + Recharts (Fase 2)
- Tests: pytest + pytest-cov
- Linting: ruff + mypy

---

## 🚀 Quick start (desarrollo local)

```bash
# Clonar
git clone git@github.com:Ka0s-Klaus/klaUS-aicalc-roi.git
cd klaUS-aicalc-roi

# Entorno Python
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"

# Tests
pytest

# Lint
ruff check .
```

---

## 💰 Modelo de precios

| Tier | Precio | Uso |
| --- | --- | --- |
| **Free** | $0 | 5 análisis/mes, catálogo básico |
| **Pro** | $29/mes | Ilimitado, catálogo completo, export Excel |
| **Team** | $99/mes | Multi-usuario, integraciones Slack/Teams |
| **Enterprise** | Custom | On-premise, white-label, SLA 99.9% |

---

## 📊 Roadmap

| Fase | Semanas | Entregable |
| --- | --- | --- |
| **Fase 1 — MVP** | 1-8 | TCO engine core + UI básica + datos estáticos |
| **Fase 2 — v1.0** | 9-20 | API pública + pipeline de datos en tiempo real + multi-usuario |
| **Fase 3 — v1.5** | 21-36 | ML predicción de precios + integraciones + análisis carbon footprint |
| **Fase 4 — v2.0** | Ongoing | On-premise + white-label + audit trail enterprise |

---

## 🤝 Contribuir

MIT License — fork, modifica y contribuye.

1. Fork el repo
2. Crea una rama: `git checkout -b GH-{N}-descripcion`
3. Commit: sigue el formato `GH-{N}: descripción`
4. Push y abre PR

---

## 📄 Licencia

[MIT](LICENSE) — libre para uso comercial, modificación y distribución.
