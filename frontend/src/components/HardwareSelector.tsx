"use client";

import type { HardwareRecommendation, HardwareSpec, ModelSpec } from "@/types/tco";

interface Props {
  hardware: HardwareSpec[];
  selected: HardwareSpec[];
  onChange: (hw: HardwareSpec[]) => void;
  localModels?: ModelSpec[];
  allRecommendations?: HardwareRecommendation[];
}

export function HardwareSelector({
  hardware,
  selected,
  onChange,
  localModels = [],
  allRecommendations = [],
}: Props) {
  const maxRequiredVram = localModels.reduce((max, m) => Math.max(max, m.min_vram_gb ?? 0), 0);

  const toggle = (hw: HardwareSpec) => {
    const exists = selected.some((h) => h.id === hw.id);
    if (exists) {
      onChange(selected.filter((h) => h.id !== hw.id));
    } else {
      onChange([...selected, { ...hw, quantity: 1 }]);
    }
  };

  const setQuantity = (id: string, qty: number) => {
    onChange(selected.map((h) => (h.id === id ? { ...h, quantity: qty } : h)));
  };

  const getRecommendation = (hw: HardwareSpec) =>
    allRecommendations.find((r) => r.hardware.id === hw.id);

  const isAutoRecommended = (hw: HardwareSpec) =>
    getRecommendation(hw) !== undefined;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="font-semibold text-gray-700">
          Hardware GPU{" "}
          <span className="text-xs font-normal text-gray-400">
            (requerido para modelos local)
          </span>
        </h3>
        {allRecommendations.length > 0 && (
          <span className="text-xs bg-blue-50 border border-blue-200 text-blue-700 rounded-full px-2 py-0.5">
            🤖 {allRecommendations.length} opción{allRecommendations.length > 1 ? "es" : ""} recomendada{allRecommendations.length > 1 ? "s" : ""}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {hardware.map((hw) => {
          const sel = selected.find((h) => h.id === hw.id);
          const isSelected = !!sel;
          const qty = sel?.quantity ?? 1;
          const effectiveVram = hw.vram_gb * qty;
          const fitsAllModels = maxRequiredVram === 0 || effectiveVram >= maxRequiredVram;
          const autoRec = isAutoRecommended(hw);
          const rec = getRecommendation(hw);

          return (
            <div
              key={hw.id}
              className={`p-2 rounded-lg border text-left text-sm transition-colors ${
                isSelected
                  ? "bg-purple-600 text-white border-purple-600"
                  : autoRec
                    ? "bg-blue-50 text-gray-700 border-blue-400 ring-1 ring-blue-300"
                    : fitsAllModels
                      ? "bg-white text-gray-700 border-gray-300 hover:border-purple-400"
                      : "bg-red-50 text-gray-700 border-red-200 hover:border-red-400"
              }`}
            >
              <button
                type="button"
                onClick={() => toggle(hw)}
                className="w-full text-left"
              >
                <p className="font-medium leading-tight flex items-center gap-1">
                  {hw.name}
                  {autoRec && !isSelected && (
                    <span className="text-blue-600 text-xs" title="Recomendado automáticamente">
                      🤖
                    </span>
                  )}
                  {!fitsAllModels && !isSelected && !autoRec && (
                    <span className="text-red-500 text-xs" title={`Requiere ${maxRequiredVram} GB VRAM`}>⚠️</span>
                  )}
                </p>
                <p className={`text-xs mt-0.5 ${
                  isSelected
                    ? "opacity-80"
                    : autoRec
                      ? "text-blue-600"
                      : fitsAllModels
                        ? "text-gray-500"
                        : "text-red-400"
                }`}>
                  {effectiveVram} GB VRAM · ${hw.purchase_price_usd}
                  {autoRec && !isSelected && rec && rec.units_needed > 1 && (
                    <span className="ml-1 text-blue-500">
                      (×{rec.units_needed} → {rec.total_vram_gb} GB)
                    </span>
                  )}
                  {!fitsAllModels && !isSelected && !autoRec && (
                    <span className="ml-1">(insuficiente)</span>
                  )}
                </p>
              </button>

              {isSelected && (
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span className="text-xs opacity-75">Unidades:</span>
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (qty > 1) setQuantity(hw.id, qty - 1);
                      }}
                      disabled={qty <= 1}
                      className="w-5 h-5 rounded bg-white/20 text-white font-bold text-xs flex items-center justify-center disabled:opacity-30 hover:bg-white/30"
                    >
                      −
                    </button>
                    <span className="w-5 text-center text-xs font-semibold">{qty}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (qty < 8) setQuantity(hw.id, qty + 1);
                      }}
                      disabled={qty >= 8}
                      className="w-5 h-5 rounded bg-white/20 text-white font-bold text-xs flex items-center justify-center disabled:opacity-30 hover:bg-white/30"
                    >
                      +
                    </button>
                  </div>
                  {qty > 1 && (
                    <span className="text-xs opacity-60">
                      ({effectiveVram} GB total)
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
