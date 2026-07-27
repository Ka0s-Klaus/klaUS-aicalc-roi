"use client";

import { Fragment } from "react";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
  total: number;
  capex: number;
  opex: number;
  key: string;
  isPareto: boolean;
  isRecommended: boolean;
  monthlyElectricity: number | null;
  monthlyMaintenance: number | null;
}

function shortLabel(s: StrategyCost): string {
  const model = s.model_id.replace(/-\d+\.\d+$/, "").slice(0, 20);
  return s.hardware_id ? `${model} / ${s.hardware_id.slice(0, 10)}` : model;
}

function resolveOpex(s: StrategyCost): number {
  // Cloud API: all cost is in api_cost_total_usd (opex_total_usd is 0)
  if (s.deployment_type === "cloud_api") {
    return Math.round(parseFloat(s.api_cost_total_usd));
  }
  return Math.round(parseFloat(s.opex_total_usd));
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
      monthlyElectricity: s.monthly_electricity_usd ? Math.round(parseFloat(s.monthly_electricity_usd)) : null,
      monthlyMaintenance: s.monthly_maintenance_usd ? Math.round(parseFloat(s.monthly_maintenance_usd)) : null,
    }));

  return (
    <div className="space-y-3">
      <div className="flex gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-blue-500" /> Estrategia
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-green-500" /> Pareto óptima
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-amber-400" /> Recomendada
        </span>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 60 }}>
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
          <Tooltip
            formatter={(value, name) => [
              `$${Number(value).toLocaleString()}`,
              name === "total" ? "Coste total" : name === "capex" ? "CAPEX" : "OPEX",
            ]}
          />
          <Bar dataKey="total" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell
                key={index}
                fill={
                  entry.isRecommended
                    ? "#f59e0b"
                    : entry.isPareto
                    ? "#22c55e"
                    : "#3b82f6"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="text-left py-1.5 pr-3 font-medium">Estrategia</th>
              <th className="text-right py-1.5 pr-3 font-medium">Coste total</th>
              <th className="text-right py-1.5 pr-3 font-medium">CAPEX</th>
              <th className="text-right py-1.5 pr-3 font-medium">OPEX</th>
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
                    ${row.capex.toLocaleString()}
                  </td>
                  <td className="text-right py-1.5 pr-3 text-gray-600">
                    ${row.opex.toLocaleString()}
                  </td>
                  <td className="text-center py-1.5">{row.isPareto ? "✅" : "—"}</td>
                </tr>
                {row.monthlyElectricity !== null && (
                  <tr className={`border-b border-gray-100 ${row.isRecommended ? "bg-amber-50" : "bg-gray-50"}`}>
                    <td colSpan={5} className="px-3 pb-1.5 pt-0">
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
