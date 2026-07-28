"use client";

import type { HardwareSpec, ModelSpec, UseCase } from "@/types/tco";

interface Props {
  models: ModelSpec[];
  hardware: HardwareSpec[];
  useCase: UseCase;
}

// Enterprise capacity planning defaults (ISO 20000 / MLPerf)
const HORAS_OPERATIVAS_DIA = 8;
const DIAS_OPERATIVOS_ANIO = 220;
const HORAS_CONCURRENCIA_PICO = 4;
const TOK_SEG_OBJETIVO_USUARIO = 20; // tok/s — threshold para buena UX en coding assistants
const STREAMS_POR_USUARIO_AGENTIC = 3; // 1 principal + 2 agentes en background
const CONTEXT_USAGE_RATIO = 0.25; // uso típico de producción: 25% del context_window

function inferQuantization(effectiveVramGb: number, parametersB: number): string {
  // Bytes por parámetro: FP16=2, INT8=1, INT4=0.5, INT2=0.25
  if (effectiveVramGb >= parametersB * 2) return "FP16";
  if (effectiveVramGb >= parametersB * 1) return "INT8 (Q8_0)";
  if (effectiveVramGb >= parametersB * 0.5) return "INT4 (Q4_K_M)";
  return "INT2 (Q2_K — calidad degradada)";
}

export function SizingCard({ models, hardware, useCase }: Props) {
  const localModels = models.filter((m) => m.deployment_type === "local");
  const hasLocal = localModels.length > 0;

  const totalMonthly = useCase.monthly_input_tokens + useCase.monthly_output_tokens;
  if (totalMonthly === 0) return null;

  // ── Token distribution ────────────────────────────────────────────────────
  const tokInputPct = (useCase.monthly_input_tokens / totalMonthly) * 100;
  const tokOutPct = (useCase.monthly_output_tokens / totalMonthly) * 100;
  const tokensTotalesAnualesMM = (totalMonthly * 12) / 1_000_000;

  // ── Hardware throughput ───────────────────────────────────────────────────
  // Modelo local con mayor throughput define la capacidad del clúster
  const bestLocalModel = localModels.reduce<ModelSpec | null>((best, m) => {
    if (!best || (m.tokens_per_second_fp16 ?? 0) > (best.tokens_per_second_fp16 ?? 0)) return m;
    return best;
  }, null);

  const effectiveHwVram = hardware.reduce((s, h) => s + h.vram_gb * (h.quantity ?? 1), 0);
  const totalHwUnits = hardware.reduce((s, h) => s + (h.quantity ?? 1), 0);

  // Throughput escala con unidades para batch inference
  const hwThroughputTokSeg =
    bestLocalModel?.tokens_per_second_fp16 != null
      ? bestLocalModel.tokens_per_second_fp16 * totalHwUnits
      : null;

  // ── Capacity metrics ──────────────────────────────────────────────────────
  const usuariosConcurrentes =
    hwThroughputTokSeg != null
      ? Math.max(1, Math.floor(hwThroughputTokSeg / TOK_SEG_OBJETIVO_USUARIO))
      : null;

  const tokSegObjetivoAgentes = TOK_SEG_OBJETIVO_USUARIO * STREAMS_POR_USUARIO_AGENTIC;

  // ── On-prem specific ──────────────────────────────────────────────────────
  const quantization =
    hasLocal && bestLocalModel?.parameters_b != null && effectiveHwVram > 0
      ? inferQuantization(effectiveHwVram, bestLocalModel.parameters_b)
      : null;

  const contextoProm =
    bestLocalModel?.context_window != null
      ? Math.round(bestLocalModel.context_window * CONTEXT_USAGE_RATIO)
      : null;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <h3 className="font-semibold text-gray-700 mb-4">📐 Métricas de Dimensionamiento</h3>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Distribución de tokens */}
        <section>
          <SectionTitle>📊 Distribución de tokens</SectionTitle>
          <MetricRow label="Tokens/año" value={`${tokensTotalesAnualesMM.toFixed(1)} M`} />
          <MetricRow label="Input directo %" value={`${tokInputPct.toFixed(1)}%`} />
          <MetricRow label="Output %" value={`${tokOutPct.toFixed(1)}%`} />
          <MetricRow label="Cache read %" value="0%" dim />
          <MetricRow label="Cache write %" value="0%" dim />
          <MetricRow label="Σ pcts" value="100%" highlight />
        </section>

        {/* Capacidad operativa */}
        <section>
          <SectionTitle>⚙️ Capacidad operativa</SectionTitle>
          <MetricRow label="Horas operativas/día" value={`${HORAS_OPERATIVAS_DIA}h`} isDefault />
          <MetricRow label="Días operativos/año" value={`${DIAS_OPERATIVOS_ANIO}`} isDefault />
          <MetricRow label="Horas pico/día" value={`${HORAS_CONCURRENCIA_PICO}h`} isDefault />
          <MetricRow
            label="Usuarios concurrentes"
            value={usuariosConcurrentes != null ? `${usuariosConcurrentes}` : "—"}
          />
          <MetricRow
            label="Devs totales est."
            value={usuariosConcurrentes != null ? `${usuariosConcurrentes}` : "—"}
          />
          <MetricRow label="Tok/s objetivo/usuario" value={`${TOK_SEG_OBJETIVO_USUARIO} tok/s`} isDefault />
        </section>

        {/* On-prem & Agentes */}
        <section>
          <SectionTitle>🖥️ On-prem &amp; Agentes</SectionTitle>
          {hasLocal ? (
            <>
              <MetricRow label="Cuantización inferida" value={quantization ?? "—"} />
              <MetricRow
                label="Contexto prom. sesión"
                value={contextoProm != null ? `${contextoProm.toLocaleString("es-ES")} tok` : "—"}
              />
            </>
          ) : (
            <p className="text-xs text-gray-400 italic mb-3">Sin modelos local seleccionados</p>
          )}

          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-500 mb-2">Escenario agentic</p>
            <MetricRow label="Streams/usuario" value={`${STREAMS_POR_USUARIO_AGENTIC}`} isDefault />
            <MetricRow label="Tok/s objetivo agentes" value={`${tokSegObjetivoAgentes} tok/s`} />
          </div>
        </section>
      </div>

      <p className="mt-4 text-xs text-gray-400 border-t border-gray-50 pt-3">
        * Valores estándar ISO 20000 / MLPerf enterprise · Cache read/write modelados en Fase 2
      </p>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
      {children}
    </h4>
  );
}

interface MetricRowProps {
  label: string;
  value: string;
  highlight?: boolean;
  dim?: boolean;
  isDefault?: boolean;
}

function MetricRow({ label, value, highlight, dim, isDefault }: MetricRowProps) {
  return (
    <div className="flex justify-between items-baseline py-1 border-b border-gray-50 last:border-0 gap-2">
      <span className={`text-sm shrink-0 ${dim ? "text-gray-400" : "text-gray-600"}`}>
        {label}
      </span>
      <span
        className={`font-mono text-xs text-right ${
          highlight
            ? "text-green-700 font-semibold"
            : dim
              ? "text-gray-400"
              : isDefault
                ? "text-gray-500 italic"
                : "text-gray-800 font-medium"
        }`}
      >
        {value}
        {isDefault && <span className="not-italic text-gray-400"> *</span>}
      </span>
    </div>
  );
}
