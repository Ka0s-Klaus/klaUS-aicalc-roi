"""TCO Engine orchestrator.

Workflow:
  1. ComplianceChecker  — filters out non-conforming model+hardware combos
  2. CombinationGenerator — produces all valid (model, hardware?) pairs
  3. Calculators (parallel-ready) — compute cost, latency, quality per combo
  4. ParetoFrontier — identifies optimal cost vs quality trade-offs
  5. RecommendationEngine — selects the best strategy and explains why
"""

from .calculators import calculate_breakeven, calculate_cloud_api_cost, calculate_local_cost
from .models import (
    AnalysisResult,
    DataResidency,
    DeploymentType,
    HardwareSpec,
    ModelSpec,
    Recommendation,
    StrategyCost,
    TCOInput,
    UseCase,
)


class TCOEngine:
    """Entry point for running a full TCO analysis."""

    def analyze(self, input_data: TCOInput) -> AnalysisResult:
        use_case = input_data.use_cases[0]  # Phase 1: single use case per run

        hardware = input_data.hardware

        filtered_models, compliance_excluded = self._apply_compliance(input_data)
        strategies, calc_excluded = self._calculate_all(
            filtered_models,
            hardware,
            use_case,
            input_data,
        )
        pareto_ids = self._pareto_frontier(strategies)
        recommendation = self._recommend(strategies, pareto_ids, input_data) if strategies else None

        return AnalysisResult(
            input_summary=self._summarize(input_data),
            horizon_months=input_data.horizon_months,
            strategies=strategies,
            pareto_optimal_ids=pareto_ids,
            recommendation=recommendation,
            excluded=compliance_excluded + calc_excluded,
        )

    # ── Private steps ──────────────────────────────────────────────────────────

    def _apply_compliance(
        self, input_data: TCOInput
    ) -> tuple[list[ModelSpec], list[dict[str, str]]]:
        cf = input_data.compliance
        approved: list[ModelSpec] = []
        excluded: list[dict[str, str]] = []

        for model in input_data.models:
            warnings: list[str] = []

            if cf.exclude_china_models and model.data_residency == DataResidency.CHINA:
                excluded.append(
                    {
                        "model_id": model.id,
                        "reason": (
                            "Data residency: CHINA. Model excluded per compliance filter. "
                            "Chinese providers may not satisfy GDPR/HIPAA/FedRAMP requirements."
                        ),
                    }
                )
                continue

            if cf.allowed_residencies and model.data_residency not in cf.allowed_residencies:
                excluded.append(
                    {
                        "model_id": model.id,
                        "reason": f"Data residency '{model.data_residency}' not in allowed list",
                    }
                )
                continue

            missing = [
                s.value
                for s in cf.required_standards
                if s not in model.compliance_flags
            ]
            if missing:
                warnings.append(f"Missing compliance certifications: {', '.join(missing)}")

            model_copy = model.model_copy()
            # Attach warnings to the strategy later via calculators
            # (model itself is immutable; warnings surface in StrategyCost)
            approved.append(model_copy)

        return approved, excluded

    def _calculate_all(
        self,
        models: list[ModelSpec],
        hardware_options: list[HardwareSpec],
        use_case: UseCase,
        input_data: TCOInput,
    ) -> tuple[list[StrategyCost], list[dict[str, str]]]:
        strategies: list[StrategyCost] = []
        excluded: list[dict[str, str]] = []

        for model in models:
            if model.deployment_type == DeploymentType.CLOUD_API:
                try:
                    cost = calculate_cloud_api_cost(model, use_case, input_data.horizon_months)
                    strategies.append(cost)
                except ValueError:
                    excluded.append({"model_id": model.id, "reason": "Datos de pricing incompletos"})

            elif model.deployment_type == DeploymentType.LOCAL:
                if not hardware_options:
                    excluded.append({"model_id": model.id, "reason": "Sin hardware seleccionado para calcular coste local"})
                    continue

                fitted = False
                for hw in hardware_options:
                    effective_vram = hw.vram_gb * hw.quantity
                    if model.min_vram_gb and effective_vram < model.min_vram_gb:
                        continue  # Hardware can't fit the model
                    fitted = True
                    cost = calculate_local_cost(
                        model,
                        hw,
                        use_case,
                        input_data.electricity_cost_usd_kwh,
                        input_data.horizon_months,
                    )
                    strategies.append(cost)

                if not fitted:
                    max_vram = max(hw.vram_gb * hw.quantity for hw in hardware_options)
                    excluded.append({
                        "model_id": model.id,
                        "reason": (
                            f"VRAM insuficiente: el modelo requiere {model.min_vram_gb:.0f} GB, "
                            f"máximo disponible {max_vram:.0f} GB. "
                            "Selecciona hardware con más VRAM o añade más unidades."
                        ),
                    })

        # Attach break-even month to each local strategy vs cheapest cloud
        cloud_strategies = [s for s in strategies if s.deployment_type == DeploymentType.CLOUD_API]
        if cloud_strategies:
            cheapest_cloud = min(cloud_strategies, key=lambda s: s.total_cost_usd)
            for s in strategies:
                if s.deployment_type == DeploymentType.LOCAL:
                    s.breakeven_month = calculate_breakeven(s, cheapest_cloud)

        return strategies, excluded

    @staticmethod
    def _strategy_key(s: StrategyCost) -> str:
        """Unique identifier for a strategy: model_id for cloud, model_id/hardware_id for local."""
        return f"{s.model_id}/{s.hardware_id}" if s.hardware_id else s.model_id

    def _pareto_frontier(self, strategies: list[StrategyCost]) -> list[str]:
        """Identify strategies where no other strategy is strictly better on both cost and quality."""
        pareto: list[str] = []

        for candidate in strategies:
            dominated = False
            candidate_key = self._strategy_key(candidate)
            for other in strategies:
                if self._strategy_key(other) == candidate_key:
                    continue
                cost_better = other.total_cost_usd <= candidate.total_cost_usd
                quality_better = (other.quality_score or 0) >= (candidate.quality_score or 0)
                strictly_better_on_one = (
                    other.total_cost_usd < candidate.total_cost_usd
                    or (other.quality_score or 0) > (candidate.quality_score or 0)
                )
                if cost_better and quality_better and strictly_better_on_one:
                    dominated = True
                    break
            if not dominated:
                pareto.append(candidate_key)

        return pareto

    def _recommend(
        self, strategies: list[StrategyCost], pareto_ids: list[str], input_data: TCOInput
    ) -> Recommendation:
        if not strategies:
            raise ValueError("No valid strategies to recommend from")

        pareto = [s for s in strategies if self._strategy_key(s) in pareto_ids]
        candidates = pareto if pareto else strategies

        # Primary signal: lowest total cost among Pareto-optimal strategies
        best = min(candidates, key=lambda s: s.total_cost_usd)

        justification = [
            f"Menor coste total entre {len(candidates)} estrategias Pareto-óptimas: "
            f"${float(best.total_cost_usd):,.0f} en {input_data.horizon_months} meses",
        ]
        if best.breakeven_month:
            justification.append(
                f"Break-even vs. mejor opción cloud en el mes {best.breakeven_month}"
            )
        if best.quality_score:
            justification.append(
                f"Puntuación de calidad: {best.quality_score:.2f} (GPT-4o = 1.0)"
            )
        if best.deployment_type == DeploymentType.CLOUD_API:
            justification.append(
                "Sin CAPEX — coste proporcional al uso, ideal para volúmenes variables"
            )
        elif best.deployment_type == DeploymentType.LOCAL:
            justification.append(
                f"CAPEX único de ${float(best.capex_usd):,.0f} amortizado a lo largo del horizonte"
            )

        risks: list[str] = []
        if best.deployment_type == DeploymentType.LOCAL:
            risks.append("Hardware supply chain risk — consider RunPod/Lambda Labs as fallback")

        # Fallback: cheapest cloud option
        cloud = [s for s in strategies if s.deployment_type == DeploymentType.CLOUD_API]
        fallback_id = min(cloud, key=lambda s: s.total_cost_usd).model_id if cloud else None

        return Recommendation(
            strategy=best,
            justification=justification,
            risks=risks,
            fallback_strategy_id=fallback_id,
        )

    def _summarize(self, input_data: TCOInput) -> str:
        uc = input_data.use_cases[0]
        return (
            f"{len(input_data.models)} models × "
            f"{len(input_data.hardware)} hardware options × "
            f"{len(input_data.use_cases)} use case(s) — "
            f"{uc.concurrent_users} concurrent / {uc.total_users} total users — "
            f"{input_data.horizon_months}-month horizon"
        )
