import api from "./api";
import type { MetricsSummary } from "@/types";

export async function getMetricsSummary(params?: {
  start_date?: string;
  end_date?: string;
}): Promise<MetricsSummary> {
  return api.get("/api/v1/metrics/summary", { params });
}
