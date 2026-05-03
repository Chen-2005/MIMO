import api, { resolveBaseUrl } from "./api";
import type { CreateTTSRequest, SegmentItem, TaskCreated, TaskDetail, TaskListItem } from "@/types";

export async function createTask(req: CreateTTSRequest): Promise<TaskCreated> {
  return api.post("/api/v1/tts/tasks", req);
}

export async function getTask(taskId: number): Promise<TaskDetail> {
  return api.get(`/api/v1/tts/tasks/${taskId}`);
}

export async function listTasks(params: {
  page?: number;
  page_size?: number;
  status?: string;
  model_code?: string;
}): Promise<{ list: TaskListItem[]; total: number }> {
  return api.get("/api/v1/tts/tasks", { params });
}

export async function retryTask(taskId: number, forceFallback = false) {
  return api.post(`/api/v1/tts/tasks/${taskId}/retry`, { force_fallback: forceFallback });
}

export async function cancelTask(taskId: number) {
  return api.post(`/api/v1/tts/tasks/${taskId}/cancel`);
}

export async function getTaskSegments(taskId: number): Promise<SegmentItem[]> {
  return api.get(`/api/v1/tts/tasks/${taskId}/segments`);
}

export function getTaskAudioUrl(taskId: number): string {
  return `${resolveBaseUrl()}/api/v1/tts/tasks/${taskId}/audio`;
}
