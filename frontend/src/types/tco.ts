/**
 * Tipos TypeScript que espejan los modelos Pydantic del backend.
 * Fuente de verdad: backend/tco_engine/models.py
 */

export type DeploymentType = "cloud_api" | "local" | "cloud_gpu" | "hybrid";
export type DataResidency = "us" | "eu" | "local" | "apac" | "china";

export interface ModelSpec {
  id: string;
  name: string;
  provider: string;
  deployment_type: DeploymentType;
  context_window: number;
  data_residency: DataResidency;
  // Cloud API fields
  input_price_per_mtok?: string;
  output_price_per_mtok?: string;
  // Local fields
  parameters_b?: number;
  min_vram_gb?: number;
  tokens_per_second_fp16?: number;
  // Estimated p50 API latency (cloud) or null (computed for local by the engine)
  estimated_latency_ms?: number;
}

export interface HardwareSpec {
  id: string;
  name: string;
  vram_gb: number;
  tdp_watts: number;
  purchase_price_usd: string;
  quantity?: number; // default 1 — número de unidades en el rack
}

export interface UseCase {
  id: string;
  name: string;
  monthly_input_tokens: number;
  monthly_output_tokens: number;
  concurrent_users: number;
  total_users: number;
  precision: "FP16" | "FP8" | "INT4";
  context_window_tokens: number;
}

export interface ComplianceFilter {
  exclude_china_models?: boolean;
  allowed_residencies?: DataResidency[];
}

export interface TCOInput {
  models: ModelSpec[];
  hardware?: HardwareSpec[];
  use_cases: UseCase[];
  compliance?: ComplianceFilter;
  electricity_cost_usd_kwh?: string;
  horizon_months?: number;
}

export interface StrategyCost {
  model_id: string;
  hardware_id: string | null;
  deployment_type: DeploymentType;
  // Monetary fields — all Decimal serialized as string by FastAPI
  capex_usd: string;
  opex_total_usd: string;
  api_cost_total_usd: string;
  total_cost_usd: string;
  monthly_cost_avg_usd: string;
  // OPEX breakdown (only populated for local strategies)
  monthly_electricity_usd: string | null;
  monthly_maintenance_usd: string | null;
  // Optional fields
  breakeven_month: number | null;
  estimated_latency_ms: number | null;
  quality_score: number | null;
  compliance_warnings: string[];
}

export interface Recommendation {
  strategy: StrategyCost;
  justification: string[];
  risks: string[];
  fallback_strategy_id: string | null;
}

export interface ExcludedModel {
  model_id: string;
  reason: string;
}

export interface AnalysisResult {
  input_summary: string;
  horizon_months: number;
  strategies: StrategyCost[];
  pareto_optimal_ids: string[];
  recommendation: Recommendation | null;
  excluded: ExcludedModel[];
}

export interface HardwareRecommendation {
  hardware: HardwareSpec;
  units_needed: number;
  total_vram_gb: number;
  total_price_usd: string;
}
