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
    onChange(exists ? selected.filter((h) => h.id !== hw.id) : [...selected, hw]);
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
          const isSelected = selected.some((h) => h.id === hw.id);
          return (
            <button
              key={hw.id}
              type="button"
              onClick={() => toggle(hw)}
              className={`p-2 rounded-lg border text-left text-sm transition-colors ${
                isSelected
                  ? "bg-purple-600 text-white border-purple-600"
                  : "bg-white text-gray-700 border-gray-300 hover:border-purple-400"
              }`}
            >
              <p className="font-medium leading-tight">{hw.name}</p>
              <p className={`text-xs mt-0.5 ${isSelected ? "opacity-80" : "text-gray-500"}`}>
                {hw.vram_gb} GB VRAM · ${hw.purchase_price_usd}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
