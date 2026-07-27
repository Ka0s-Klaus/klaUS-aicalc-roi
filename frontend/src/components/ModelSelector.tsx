"use client";

import type { ModelSpec } from "@/types/tco";

interface Props {
  models: ModelSpec[];
  selected: ModelSpec[];
  onChange: (models: ModelSpec[]) => void;
}

const DEPLOYMENT_LABELS: Record<string, string> = {
  cloud_api: "☁️ Cloud API",
  local: "🖥️ Local",
  cloud_gpu: "⚡ Cloud GPU",
  hybrid: "🔀 Hybrid",
};

export function ModelSelector({ models, selected, onChange }: Props) {
  const toggle = (model: ModelSpec) => {
    const exists = selected.some((m) => m.id === model.id);
    onChange(exists ? selected.filter((m) => m.id !== model.id) : [...selected, model]);
  };

  const byDeployment = models.reduce<Record<string, ModelSpec[]>>((acc, m) => {
    (acc[m.deployment_type] ??= []).push(m);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-700">Modelos AI</h3>
      {Object.entries(byDeployment).map(([type, group]) => (
        <div key={type}>
          <p className="text-xs font-medium text-gray-500 mb-1">
            {DEPLOYMENT_LABELS[type] ?? type}
          </p>
          <div className="flex flex-wrap gap-2">
            {group.map((model) => {
              const isSelected = selected.some((m) => m.id === model.id);
              return (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => toggle(model)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    isSelected
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
                  }`}
                >
                  {model.name}
                  {model.input_price_per_mtok && (
                    <span className="ml-1 opacity-70 text-xs">
                      ${model.input_price_per_mtok}/Mtok
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {selected.length === 0 && (
        <p className="text-xs text-amber-600">Selecciona al menos un modelo.</p>
      )}
    </div>
  );
}
