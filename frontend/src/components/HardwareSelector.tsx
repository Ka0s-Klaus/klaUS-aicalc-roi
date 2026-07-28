"use client";

import type { HardwareSpec, ModelSpec } from "@/types/tco";

interface Props {
  hardware: HardwareSpec[];
  selected: HardwareSpec[];
  onChange: (hw: HardwareSpec[]) => void;
  localModels?: ModelSpec[];
}

export function HardwareSelector({ hardware, selected, onChange, localModels = [] }: Props) {
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

  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-gray-700">
        Hardware GPU{" "}
        <span className="text-xs font-normal text-gray-400">
          (requerido para modelos local)
        </span>
      </h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {hardware.map((hw) => {
          const sel = selected.find((h) => h.id === hw.id);
          const isSelected = !!sel;
          const qty = sel?.quantity ?? 1;
          const effectiveVram = hw.vram_gb * qty;

          const fitsAllModels = maxRequiredVram === 0 || effectiveVram >= maxRequiredVram;

          return (
            <div
              key={hw.id}
              className={`p-2 rounded-lg border text-left text-sm transition-colors ${
                isSelected
                  ? "bg-purple-600 text-white border-purple-600"
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
                <p className="font-medium leading-tight">
                  {hw.name}
                  {!fitsAllModels && !isSelected && (
                    <span className="ml-1 text-red-500 text-xs" title={`Requiere ${maxRequiredVram} GB VRAM`}>⚠️</span>
                  )}
                </p>
                <p className={`text-xs mt-0.5 ${isSelected ? "opacity-80" : fitsAllModels ? "text-gray-500" : "text-red-400"}`}>
                  {effectiveVram} GB VRAM · ${hw.purchase_price_usd}
                  {!fitsAllModels && !isSelected && <span className="ml-1">(insuficiente)</span>}
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
