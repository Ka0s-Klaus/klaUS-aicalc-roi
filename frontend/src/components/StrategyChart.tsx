"use client";

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

interface ChartEntry {
  name: string;
  total: number;
  capex: number;
  opex: number;
  isPareto: boolean;
  isRecommended: boolean;
}

function shortLabel(s: StrategyCost): string {
  const model = s.model_id.replace(/-\d+\.\d+$/, "").slice(0, 20);
  return s.hardware_id ? `${model} / ${s.hardware_id.slice(0, 10)}` : model;
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
      total: Math.round(parseFloat(s.total_cost_usd)),
      capex: Math.round(parseFloat(s.capex_usd)),
      opex: Math.round(parseFloat(s.opex_usd)),
      isPareto: paretoIds.includes(s.strategy_id),
      isRecommended: s.strategy_id === recommendationId,
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
              <tr
                key={i}
                className={`border-b border-gray-100 ${row.isRecommended ? "bg-amber-50" : ""}`}
              >
                <td className="py-1.5 pr-3 font-mono">
                  {row.isRecommended ? "⭐ " : ""}
                  {row.name}
                </td>
                <td className="text-right py-1.5 pr-3 font-semibold">
                  ${row.total.toLocaleString()}
                </td>
                <td className="text-right py-1.5 pr-3 text-gray-500">
                  ${row.capex.toLocaleString()}
                </td>
                <td className="text-right py-1.5 pr-3 text-gray-500">
                  ${row.opex.toLocaleString()}
                </td>
                <td className="text-center py-1.5">{row.isPareto ? "✅" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
