import api from "./api";
import type {
  VoiceProfileItem,
  VoiceProfileDetail,
  CloneSourceDetail,
  AuditLogItem,
  VoiceProfileCreated,
} from "@/types";

export async function listVoiceProfiles(profileType?: string): Promise<VoiceProfileItem[]> {
  return api.get("/api/v1/voice-profiles", { params: { profile_type: profileType } });
}

export async function getVoiceProfile(id: number): Promise<VoiceProfileDetail> {
  return api.get(`/api/v1/voice-profiles/${id}`);
}

export async function updateVoiceProfile(id: number, data: {
  name?: string;
  description?: string;
  gender_hint?: string;
  age_hint?: string;
  language_hint?: string;
  is_public?: number;
}): Promise<VoiceProfileItem> {
  return api.patch(`/api/v1/voice-profiles/${id}`, data);
}

export async function deleteVoiceProfile(id: number) {
  return api.delete<{ message: string }>(`/api/v1/voice-profiles/${id}`);
}

export async function createVoiceDesign(data: {
  name: string;
  model_code: string;
  description: string;
}): Promise<VoiceProfileCreated> {
  return api.post<VoiceProfileCreated>("/api/v1/voice-profiles/design", data);
}

export async function createVoiceClone(data: {
  name: string;
  model_code: string;
  source_audio_url: string;
  consent_type?: string;
  consent_statement?: string;
}): Promise<VoiceProfileCreated> {
  return api.post<VoiceProfileCreated>("/api/v1/voice-profiles/clone", data);
}

export async function uploadVoiceCloneAudio(file: File): Promise<{ source_audio_url: string }> {
  const formData = new FormData();
  formData.append("file", file);
  return api.post("/api/v1/voice-profiles/clone/audio", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

export async function getCloneSource(id: number): Promise<CloneSourceDetail> {
  return api.get(`/api/v1/voice-profiles/${id}/clone-source`);
}

export async function approveClone(id: number, reviewNote?: string) {
  return api.post<VoiceProfileCreated>(`/api/v1/voice-profiles/${id}/clone/approve`, {
    review_note: reviewNote,
  });
}

export async function rejectClone(id: number, reviewNote: string) {
  return api.post<VoiceProfileCreated>(`/api/v1/voice-profiles/${id}/clone/reject`, {
    review_note: reviewNote,
  });
}

export async function uploadConsentProof(id: number, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return api.post<{ consent_proof_url: string }>(
    `/api/v1/voice-profiles/${id}/consent-proof`,
    formData,
    {
    headers: { "Content-Type": "multipart/form-data" },
    }
  );
}

export async function getAuditLogs(params?: {
  entity_type?: string;
  entity_id?: number;
  page?: number;
  page_size?: number;
}): Promise<AuditLogItem[]> {
  return api.get("/api/v1/voice-profiles/audit-logs", { params });
}
