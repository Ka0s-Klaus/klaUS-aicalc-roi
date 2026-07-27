"use client";

import type { HardwareSpec } from "@/types/tco";

interface Props {
  hardware: HardwareSpec[];
  selected: HardwareSpec[];
  onChange: (hw: HardwareSpec[]) => void;
}

export function HardwareSelector({ hardware, selected, onChange }: Props) {
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

          return (
            <div
              key={hw.id}
              className={`p-2 rounded-lg border text-left text-sm transition-colors ${
                isSelected
                  ? "bg-purple-600 text-white border-purple-600"
                  : "bg-white text-gray-700 border-gray-300 hover:border-purple-400"
              }`}
            >
              <button
                type="button"
                onClick={() => toggle(hw)}
                className="w-full text-left"
              >
                <p className="font-medium leading-tight">{hw.name}</p>
                <p className={`text-xs mt-0.5 ${isSelected ? "opacity-80" : "text-gray-500"}`}>
                  {effectiveVram} GB VRAM · ${hw.purchase_price_usd}
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
