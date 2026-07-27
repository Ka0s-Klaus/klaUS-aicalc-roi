/**
 * Cliente tipado para la API REST de klaUS-aicalc-roi.
 * Base URL configurable via NEXT_PUBLIC_API_URL (default: http://localhost:8000)
 */

import type {
  AnalysisResult,
  HardwareSpec,
  ModelSpec,
  TCOInput,
} from "@/types/tco";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchModels(params?: {
  deployment_type?: string;
  data_residency?: string;
}): Promise<ModelSpec[]> {
  const qs = new URLSearchParams();
  if (params?.deployment_type) qs.set("deployment_type", params.deployment_type);
  if (params?.data_residency) qs.set("data_residency", params.data_residency);
  const query = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch<ModelSpec[]>(`/v1/models${query}`);
}

export async function fetchHardware(): Promise<HardwareSpec[]> {
  return apiFetch<HardwareSpec[]>("/v1/hardware");
}

export async function analyze(input: TCOInput): Promise<AnalysisResult> {
  return apiFetch<AnalysisResult>("/v1/analyze", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
