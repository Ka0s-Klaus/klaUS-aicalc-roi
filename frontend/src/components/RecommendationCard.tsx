"use client";

import type { AnalysisResult, DeploymentType } from "@/types/tco";

interface Props {
  result: AnalysisResult;
}

const DEPLOY_BADGE: Record<DeploymentType, { icon: string; label: string; bg: string; text: string }> = {
  cloud_api: { icon: "☁️", label: "Cloud API", bg: "bg-blue-100", text: "text-blue-800" },
  local:     { icon: "🖥️", label: "Local GPU",  bg: "bg-purple-100", text: "text-purple-800" },
  cloud_gpu: { icon: "⚡", label: "Cloud GPU",  bg: "bg-indigo-100", text: "text-indigo-800" },
  hybrid:    { icon: "🔀", label: "Hybrid",     bg: "bg-teal-100",   text: "text-teal-800" },
};

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

  // Cost comparison vs best alternative of the opposite deployment type
  const savingsLine = (() => {
    if (!recommended) return null;
    const recCost = parseFloat(recommended.total_cost_usd);
    const isLocal = recommended.deployment_type === "local";
    const altType = isLocal ? "cloud_api" : "local";
    const alts = strategies.filter((s) => s.deployment_type === altType);
    if (alts.length === 0) return null;
    const bestAlt = alts.reduce((a, b) =>
      parseFloat(a.total_cost_usd) < parseFloat(b.total_cost_usd) ? a : b,
    );
    const altCost = parseFloat(bestAlt.total_cost_usd);
    const pct = Math.round(Math.abs(1 - recCost / altCost) * 100);
    const altLabel = isLocal ? "la mejor opción cloud" : "la mejor opción local";
    if (recCost < altCost) {
      return `${pct}% más barato que ${altLabel} (${bestAlt.model_id}, $${Math.round(altCost).toLocaleString()})`;
    }
    return `${pct}% más caro que ${altLabel} (${bestAlt.model_id}, $${Math.round(altCost).toLocaleString()})`;
  })();

  return (
    <div className="space-y-4">
      {recommendation && recommended && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-5">
          {/* Header row */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-green-600 uppercase tracking-wide mb-2">
                ✅ Recomendación óptima
              </p>

              {/* Deployment type badge */}
              {(() => {
                const badge = DEPLOY_BADGE[recommended.deployment_type];
                return (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold mb-2 ${badge.bg} ${badge.text}`}>
                    {badge.icon} {badge.label}
                  </span>
                );
              })()}

              {/* Model + hardware */}
              <p className="font-bold text-green-900 text-lg leading-tight">
                {recommended.model_id}
                {recommended.hardware_id && (
                  <span className="text-base font-normal text-green-700">
                    {" "}+ {recommended.hardware_id}
                  </span>
                )}
              </p>

              {/* Savings line */}
              {savingsLine && (
                <p className="text-sm font-medium text-green-700 mt-1">
                  💰 {savingsLine}
                </p>
              )}

              {/* Engine justification */}
              <ul className="text-sm text-green-700 mt-2 space-y-0.5">
                {recommendation.justification.map((line, i) => (
                  <li key={i} className="flex gap-1">
                    <span className="shrink-0">•</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Cost box */}
            <div className="text-right shrink-0">
              <p className="text-2xl font-bold text-green-900">
                ${parseFloat(recommended.total_cost_usd).toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}
              </p>
              <p className="text-xs text-green-600">coste total</p>
              <p className="text-xs text-green-600 mt-0.5">
                ${parseFloat(recommended.monthly_cost_avg_usd).toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}/mes
              </p>
              {recommended.breakeven_month !== null && (
                <p className="text-xs text-green-600 mt-1 font-medium">
                  Break-even: mes {recommended.breakeven_month}
                </p>
              )}
            </div>
          </div>

          {/* Risks */}
          {recommendation.risks.length > 0 && (
            <div className="mt-3 pt-3 border-t border-green-200">
              <p className="text-xs font-medium text-green-700 mb-1">⚠️ Riesgos a considerar</p>
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
