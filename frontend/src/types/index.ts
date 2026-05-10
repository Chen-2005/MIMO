export interface CreateTTSRequest {
  request_id: string;
  text: string;
  model_code: string;
  voice_profile_id?: number;
  style_prompt?: string;
  speed?: number;
  pitch?: number;
  volume?: number;
  emotion?: string;
  output_format?: "wav";
  enable_fallback?: boolean;
}

export interface TaskCreated {
  task_id: number;
  task_no: string;
  status: string;
}

export interface TaskDetail {
  task_id: number;
  task_no: string;
  status: string;
  model_code: string;
  final_model_code?: string;
  fallback_used: boolean;
  voice_profile_id?: number;
  text_char_count: number;
  style_prompt?: string;
  speed?: number;
  output_format: "wav";
  audio_url?: string;
  audio_duration_ms?: number;
  provider_error_code?: string;
  provider_error_message?: string;
  segment_count: number;
  created_at?: string;
  finished_at?: string;
}

export interface SegmentItem {
  segment_no: number;
  segment_text: string;
  char_count: number;
  status: string;
  audio_url?: string;
  audio_duration_ms?: number;
  error_code?: string;
}

export interface TaskListItem {
  task_id: number;
  task_no: string;
  status: string;
  model_code: string;
  fallback_used: boolean;
  audio_url?: string;
  audio_duration_ms?: number;
  created_at?: string;
}

export interface VoiceProfileItem {
  id: number;
  profile_type: string;
  name: string;
  model_code: string;
  provider_voice_id?: string;
  description?: string;
  gender_hint?: string;
  age_hint?: string;
  language_hint?: string;
  status: string;
  is_public: number;
  audio_url?: string;
  isLocal?: boolean;
}

export interface VoiceProfileDetail extends VoiceProfileItem {
  is_public: number;
  created_at?: string;
  updated_at?: string;
}

export interface VoiceProfileCreated {
  voice_profile_id: number;
  status: string;
  risk_status?: string;
}

export interface CloneSourceDetail {
  id: number;
  voice_profile_id: number;
  source_audio_url: string;
  consent_type: string;
  consent_statement: string;
  consent_proof_url?: string;
  risk_status: string;
  review_note?: string;
}

export interface AuditLogItem {
  id: number;
  action: string;
  entity_type: string;
  entity_id?: number;
  detail?: string;
  created_at?: string;
}

export interface MetricsSummary {
  request_count: number;
  success_count: number;
  failure_count: number;
  fallback_count: number;
  text_char_count: number;
  audio_duration_ms: number;
  estimated_cost: number;
  clone_request_count: number;
}
