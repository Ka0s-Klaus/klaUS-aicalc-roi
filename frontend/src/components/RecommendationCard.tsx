"use client";

import type { AnalysisResult } from "@/types/tco";

interface Props {
  result: AnalysisResult;
}

export function RecommendationCard({ result }: Props) {
  const { recommendation, excluded, strategies } = result;

  if (!recommendation && strategies.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
        <p className="font-semibold text-amber-800">Sin estrategias válidas</p>
        {excluded.length > 0 && (
          <ul className="mt-2 space-y-1 text-sm text-amber-700">
            {excluded.map((e, i) => (
              <li key={i}>
                <span className="font-mono">{e.model_id}</span> — {e.reason}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const recommended = recommendation?.strategy ?? null;

  return (
    <div className="space-y-4">
      {recommendation && recommended && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-green-600 uppercase tracking-wide mb-1">
                ✅ Recomendación óptima
              </p>
              <p className="font-bold text-green-900 text-lg">
                {recommended.model_id}
                {recommended.hardware_id && (
                  <span className="text-base font-normal text-green-700">
                    {" "}+ {recommended.hardware_id}
                  </span>
                )}
              </p>
              <ul className="text-sm text-green-700 mt-1 space-y-0.5">
                {recommendation.justification.map((line, i) => (
                  <li key={i}>• {line}</li>
                ))}
              </ul>
            </div>
            <div className="text-right shrink-0">
              <p className="text-2xl font-bold text-green-900">
                ${parseFloat(recommended.total_cost_usd).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-green-600">coste total</p>
              {recommended.breakeven_month !== null && (
                <p className="text-xs text-green-600 mt-1">
                  Break-even: mes {recommended.breakeven_month}
                </p>
              )}
            </div>
          </div>
          {recommendation.risks.length > 0 && (
            <div className="mt-3 pt-3 border-t border-green-200">
              <p className="text-xs font-medium text-green-700 mb-1">⚠️ Riesgos</p>
              <ul className="text-xs text-green-700 space-y-0.5">
                {recommendation.risks.map((r, i) => (
                  <li key={i}>• {r}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {excluded.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="text-xs font-medium text-gray-600 mb-2">🚫 Excluidos por compliance</p>
          <ul className="space-y-1">
            {excluded.map((e, i) => (
              <li key={i} className="text-xs text-gray-600">
                <span className="font-mono bg-gray-200 px-1 rounded">{e.model_id}</span>{" "}
                — {e.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
