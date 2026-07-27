"use client";

import { Fragment } from "react";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { AnalysisResult, StrategyCost } from "@/types/tco";

interface Props {
  strategies: StrategyCost[];
  paretoIds: AnalysisResult["pareto_optimal_ids"];
  recommendationId: string | null;
}

function strategyKey(s: StrategyCost): string {
  return s.hardware_id ? `${s.model_id}/${s.hardware_id}` : s.model_id;
}

interface ChartEntry {
  name: string;
  capex: number;
  opex: number;
  total: number;
  key: string;
  isPareto: boolean;
  isRecommended: boolean;
  qualityScore: number | null;
  latencyMs: number | null;
  monthlyElectricity: number | null;
  monthlyMaintenance: number | null;
  deploymentType: string;
}

function shortLabel(s: StrategyCost): string {
  const model = s.model_id.replace(/-\d+\.\d+$/, "").slice(0, 22);
  return s.hardware_id ? `${model} / ${s.hardware_id.slice(0, 12)}` : model;
}

function resolveOpex(s: StrategyCost): number {
  if (s.deployment_type === "cloud_api") {
    return Math.round(parseFloat(s.api_cost_total_usd));
  }
  return Math.round(parseFloat(s.opex_total_usd));
}

function stateColor(entry: ChartEntry, variant: "capex" | "opex"): string {
  const alpha = variant === "capex" ? "dark" : "light";
  if (entry.isRecommended) return alpha === "dark" ? "#d97706" : "#f59e0b";
  if (entry.isPareto) return alpha === "dark" ? "#16a34a" : "#22c55e";
  return alpha === "dark" ? "#4f46e5" : "#6366f1";
}

interface TooltipPayload {
  name: string;
  value: number;
  payload: ChartEntry;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const entry = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs space-y-1">
      <p className="font-semibold text-gray-900 mb-1">{entry.name}</p>
      <p className="text-gray-600">
        <span className="inline-block w-16">CAPEX:</span>
        <span className="font-medium">${entry.capex.toLocaleString()}</span>
      </p>
      <p className="text-gray-600">
        <span className="inline-block w-16">OPEX:</span>
        <span className="font-medium">${entry.opex.toLocaleString()}</span>
      </p>
      <p className="text-gray-900 font-semibold border-t border-gray-100 pt-1">
        <span className="inline-block w-16">Total:</span>
        <span>${entry.total.toLocaleString()}</span>
      </p>
      {entry.qualityScore !== null && (
        <p className="text-gray-500">
          <span className="inline-block w-16">Calidad:</span>
          <span>{entry.qualityScore.toFixed(2)}</span>
        </p>
      )}
      {entry.isRecommended && (
        <p className="text-amber-600 font-semibold">⭐ Recomendada</p>
      )}
      {entry.isPareto && !entry.isRecommended && (
        <p className="text-green-600 font-semibold">✅ Pareto óptima</p>
      )}
    </div>
  );
}

export function StrategyChart({ strategies, paretoIds, recommendationId }: Props) {
  if (strategies.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        Sin estrategias para mostrar.
      </div>
    );
  }

  const data: ChartEntry[] = strategies
    .slice()
    .sort((a, b) => parseFloat(a.total_cost_usd) - parseFloat(b.total_cost_usd))
    .map((s) => ({
      name: shortLabel(s),
      key: strategyKey(s),
      total: Math.round(parseFloat(s.total_cost_usd)),
      capex: Math.round(parseFloat(s.capex_usd)),
      opex: resolveOpex(s),
      isPareto: paretoIds.includes(strategyKey(s)),
      isRecommended: strategyKey(s) === recommendationId,
      qualityScore: s.quality_score ?? null,
      latencyMs: s.estimated_latency_ms ?? null,
      deploymentType: s.deployment_type,
      monthlyElectricity:
        s.monthly_electricity_usd != null
          ? Math.round(parseFloat(s.monthly_electricity_usd))
          : null,
      monthlyMaintenance:
        s.monthly_maintenance_usd != null
          ? Math.round(parseFloat(s.monthly_maintenance_usd))
          : null,
    }));

  return (
    <div className="space-y-6">
      {/* Stacked bar chart: CAPEX (bottom) + OPEX (top) */}
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 72 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 10 }}
            angle={-35}
            textAnchor="end"
            interval={0}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(v: number) => `$${v.toLocaleString()}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="top"
            height={28}
            formatter={(value: string) => (value === "capex" ? "CAPEX" : "OPEX / API")}
          />
          <Bar dataKey="capex" stackId="cost" name="capex">
            {data.map((entry, i) => (
              <Cell key={i} fill={stateColor(entry, "capex")} />
            ))}
          </Bar>
          <Bar dataKey="opex" stackId="cost" name="opex" radius={[4, 4, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={stateColor(entry, "opex")} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Color legend */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-indigo-500" /> Estrategia (OPEX)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-indigo-700" /> Estrategia (CAPEX)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-green-500" /> Pareto óptima
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-amber-400" /> Recomendada
        </span>
      </div>

      {/* Strategy table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="text-left py-1.5 pr-3 font-medium">Estrategia</th>
              <th className="text-right py-1.5 pr-3 font-medium">Total</th>
              <th className="text-right py-1.5 pr-3 font-medium">CAPEX</th>
              <th className="text-right py-1.5 pr-3 font-medium">OPEX</th>
              <th className="text-right py-1.5 pr-3 font-medium">Calidad</th>
              <th className="text-right py-1.5 pr-3 font-medium">Latencia</th>
              <th className="text-center py-1.5 font-medium">Pareto</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <Fragment key={i}>
                <tr
                  className={`border-b ${row.monthlyElectricity !== null ? "border-gray-50" : "border-gray-100"} ${row.isRecommended ? "bg-amber-50" : ""}`}
                >
                  <td className="py-1.5 pr-3 font-mono text-gray-800">
                    {row.isRecommended ? "⭐ " : ""}
                    {row.name}
                  </td>
                  <td className="text-right py-1.5 pr-3 font-semibold text-gray-900">
                    ${row.total.toLocaleString()}
                  </td>
                  <td className="text-right py-1.5 pr-3 text-gray-600">
                    {row.capex > 0 ? `$${row.capex.toLocaleString()}` : "—"}
                  </td>
                  <td className="text-right py-1.5 pr-3 text-gray-600">
                    ${row.opex.toLocaleString()}
                  </td>
                  <td className="text-right py-1.5 pr-3 text-gray-500">
                    {row.qualityScore !== null ? row.qualityScore.toFixed(2) : "—"}
                  </td>
                  <td className="text-right py-1.5 pr-3 text-gray-500">
                    {row.latencyMs !== null ? `${Math.round(row.latencyMs)} ms` : "—"}
                  </td>
                  <td className="text-center py-1.5">{row.isPareto ? "✅" : "—"}</td>
                </tr>
                {row.monthlyElectricity !== null && (
                  <tr
                    className={`border-b border-gray-100 ${row.isRecommended ? "bg-amber-50" : "bg-gray-50"}`}
                  >
                    <td colSpan={7} className="px-3 pb-1.5 pt-0">
                      <span className="text-gray-400 text-xs">
                        ↳ Electricidad:{" "}
                        <span className="text-gray-600 font-medium">
                          ${row.monthlyElectricity.toLocaleString()}/mes
                        </span>
                        {row.monthlyMaintenance !== null && (
                          <>
                            {"  ·  "}Mantenimiento:{" "}
                            <span className="text-gray-600 font-medium">
                              ${row.monthlyMaintenance.toLocaleString()}/mes
                            </span>
                          </>
                        )}
                      </span>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
