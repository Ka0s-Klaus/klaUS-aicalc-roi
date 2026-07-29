"use client";

import type { UseCase } from "@/types/tco";

interface Props {
  useCase: UseCase;
  onChange: (uc: UseCase) => void;
  horizonMonths: number;
  onHorizonChange: (months: number) => void;
}

const HORIZON_OPTIONS = [
  { label: "1 mes", value: 1 },
  { label: "6 meses", value: 6 },
  { label: "12 meses", value: 12 },
  { label: "24 meses", value: 24 },
  { label: "36 meses", value: 36 },
  { label: "60 meses", value: 60 },
];

function numField(
  label: string,
  value: number,
  onChange: (v: number) => void,
  hint?: string,
) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-400 mb-1">{hint}</p>}
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
    </div>
  );
}

export function UseCaseForm({ useCase, onChange, horizonMonths, onHorizonChange }: Props) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-700">Caso de uso</h3>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Nombre</label>
        <input
          type="text"
          value={useCase.name}
          onChange={(e) => onChange({ ...useCase, name: e.target.value })}
          className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="Ej: Coding assistant"
        />
      </div>

      {numField(
        "Tokens de entrada / mes",
        useCase.monthly_input_tokens,
        (v) => onChange({ ...useCase, monthly_input_tokens: v }),
        "Número de tokens de prompt enviados mensualmente",
      )}

      {numField(
        "Tokens de salida / mes",
        useCase.monthly_output_tokens,
        (v) => onChange({ ...useCase, monthly_output_tokens: v }),
        "Número de tokens de respuesta generados mensualmente",
      )}

      {numField(
        "Usuarios concurrentes",
        useCase.concurrent_users,
        (v) => onChange({ ...useCase, concurrent_users: Math.max(1, v) }),
        "Número de usuarios haciendo peticiones simultáneamente",
      )}

      {numField(
        "Usuarios totales",
        useCase.total_users,
        (v) => onChange({ ...useCase, total_users: Math.max(1, v) }),
        "Número total de usuarios únicos que usarán el sistema",
      )}

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Precisión de inferencia
        </label>
        <p className="text-xs text-gray-400 mb-1">Afecta tamaño de KV cache y throughput de GPU</p>
        <div className="flex gap-2">
          {(["FP16", "FP8", "INT4"] as const).map((prec) => (
            <button
              key={prec}
              type="button"
              onClick={() => onChange({ ...useCase, precision: prec })}
              className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                useCase.precision === prec
                  ? "bg-purple-600 text-white border-purple-600"
                  : "bg-white text-gray-700 border-gray-300 hover:border-purple-400"
              }`}
            >
              {prec}
            </button>
          ))}
        </div>
      </div>

      {numField(
        "Context window (tokens)",
        useCase.context_window_tokens,
        (v) => onChange({ ...useCase, context_window_tokens: Math.max(512, v) }),
        "Longitud máxima de contexto esperado en tokens",
      )}

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Horizonte de análisis
        </label>
        <div className="flex flex-wrap gap-2">
          {HORIZON_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onHorizonChange(opt.value)}
              className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                horizonMonths === opt.value
                  ? "bg-green-600 text-white border-green-600"
                  : "bg-white text-gray-600 border-gray-300 hover:border-green-400"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
