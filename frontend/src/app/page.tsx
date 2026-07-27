"use client";

import { useEffect, useState } from "react";

import { HardwareSelector } from "@/components/HardwareSelector";
import { ModelSelector } from "@/components/ModelSelector";
import { RecommendationCard } from "@/components/RecommendationCard";
import { StrategyChart } from "@/components/StrategyChart";
import { UseCaseForm } from "@/components/UseCaseForm";
import { analyze, fetchHardware, fetchModels } from "@/lib/api";
import type {
  AnalysisResult,
  HardwareSpec,
  ModelSpec,
  UseCase,
} from "@/types/tco";

const DEFAULT_USE_CASE: UseCase = {
  id: "default",
  name: "Coding assistant",
  monthly_input_tokens: 10_000_000,
  monthly_output_tokens: 4_000_000,
};

export default function HomePage() {
  const [allModels, setAllModels] = useState<ModelSpec[]>([]);
  const [allHardware, setAllHardware] = useState<HardwareSpec[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [selectedModels, setSelectedModels] = useState<ModelSpec[]>([]);
  const [selectedHardware, setSelectedHardware] = useState<HardwareSpec[]>([]);
  const [useCase, setUseCase] = useState<UseCase>(DEFAULT_USE_CASE);
  const [horizonMonths, setHorizonMonths] = useState(36);

  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchModels(), fetchHardware()])
      .then(([models, hardware]) => {
        setAllModels(models);
        setAllHardware(hardware);
        // Pre-seleccionar Claude Sonnet y Llama 8B como ejemplo representativo
        const defaults = models.filter((m) =>
          ["claude-sonnet-4-6", "llama-3-1-8b-local"].includes(m.id),
        );
        setSelectedModels(defaults);
        const rtx = hardware.find((h) => h.id === "rtx-4090-24gb");
        if (rtx) setSelectedHardware([rtx]);
      })
      .catch((e: unknown) =>
        setCatalogError(e instanceof Error ? e.message : String(e)),
      )
      .finally(() => setLoadingCatalog(false));
  }, []);

  const handleAnalyze = async () => {
    setAnalyzeError(null);
    setResult(null);
    setAnalyzing(true);
    try {
      const res = await analyze({
        models: selectedModels,
        hardware: selectedHardware.length > 0 ? selectedHardware : undefined,
        use_cases: [useCase],
        horizon_months: horizonMonths,
      });
      setResult(res);
    } catch (e: unknown) {
      setAnalyzeError(e instanceof Error ? e.message : String(e));
    } finally {
      setAnalyzing(false);
    }
  };

  if (loadingCatalog) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500 animate-pulse">Cargando catálogo…</p>
      </main>
    );
  }

  if (catalogError) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 max-w-md text-center">
          <p className="font-semibold text-red-800 mb-2">Error al cargar el catálogo</p>
          <p className="text-sm text-red-600 font-mono">{catalogError}</p>
          <p className="text-xs text-red-500 mt-3">
            Asegúrate de que la API está corriendo en{" "}
            <code>{process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}</code>
          </p>
        </div>
      </main>
    );
  }

  const hasLocalModel = selectedModels.some((m) => m.deployment_type === "local");
  const canAnalyze =
    selectedModels.length > 0 &&
    (!hasLocalModel || selectedHardware.length > 0) &&
    useCase.name.trim() !== "" &&
    useCase.monthly_input_tokens > 0;

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <span className="text-2xl">💰</span>
          <div>
            <h1 className="text-xl font-bold text-gray-900">klaUS-aicalc-roi</h1>
            <p className="text-xs text-gray-500">TCO Calculator for AI Infrastructure</p>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Formulario */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-8">
          <h2 className="text-lg font-bold text-gray-800">⚙️ Configurar análisis</h2>

          <ModelSelector
            models={allModels}
            selected={selectedModels}
            onChange={setSelectedModels}
          />

          {hasLocalModel && (
            <HardwareSelector
              hardware={allHardware}
              selected={selectedHardware}
              onChange={setSelectedHardware}
            />
          )}

          <UseCaseForm
            useCase={useCase}
            onChange={setUseCase}
            horizonMonths={horizonMonths}
            onHorizonChange={setHorizonMonths}
          />

          {hasLocalModel && selectedHardware.length === 0 && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              ⚠️ Has seleccionado modelos locales — selecciona al menos un hardware GPU.
            </p>
          )}

          <button
            onClick={handleAnalyze}
            disabled={!canAnalyze || analyzing}
            className="w-full py-3 px-6 rounded-xl font-semibold text-white transition-colors
              bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {analyzing ? "Analizando…" : "🔍 Analizar TCO"}
          </button>

          {analyzeError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {analyzeError}
            </p>
          )}
        </div>

        {/* Resultados */}
        {result && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-gray-800">📊 Resultados</h2>

            <RecommendationCard result={result} />

            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-700 mb-4">
                Coste total por estrategia ({horizonMonths} meses)
              </h3>
              <StrategyChart
                strategies={result.strategies}
                paretoIds={result.pareto_optimal_ids}
                recommendationId={(() => {
                  const s = result.recommendation?.strategy;
                  if (!s) return null;
                  return s.hardware_id ? `${s.model_id}/${s.hardware_id}` : s.model_id;
                })()}
              />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
