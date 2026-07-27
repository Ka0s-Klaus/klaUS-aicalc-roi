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
}

export interface HardwareSpec {
  id: string;
  name: string;
  vram_gb: number;
  tdp_watts: number;
  purchase_price_usd: string;
}

export interface UseCase {
  id: string;
  name: string;
  monthly_input_tokens: number;
  monthly_output_tokens: number;
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
  strategy_id: string;
  model_id: string;
  hardware_id: string | null;
  deployment_type: DeploymentType;
  total_cost_usd: string;
  monthly_cost_usd: string;
  capex_usd: string;
  opex_usd: string;
  quality_score: number;
}

export interface Recommendation {
  strategy_id: string;
  rationale: string;
  risks: string[];
  payback_months: number | null;
}

export interface ExcludedModel {
  model_id: string;
  reason: string;
}

export interface AnalysisResult {
  strategies: StrategyCost[];
  pareto_optimal_ids: string[];
  recommendation: Recommendation | null;
  excluded: ExcludedModel[];
}
