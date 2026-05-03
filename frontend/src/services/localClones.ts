const STORAGE_KEY = "mimo_local_clones";

export interface LocalClone {
  voice_profile_id: number;
  provider_voice_id: string;
  name: string;
  model_code: string;
  source_audio_url: string;
  consent_type: string;
  consent_statement: string;
  created_at: string;
}

export function getLocalClones(): LocalClone[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalClone(clone: LocalClone): void {
  const clones = getLocalClones();
  const existing = clones.findIndex((c) => c.voice_profile_id === clone.voice_profile_id);
  if (existing >= 0) {
    clones[existing] = clone;
  } else {
    clones.push(clone);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clones));
}

export function removeLocalClone(voiceProfileId: number): void {
  const clones = getLocalClones().filter((c) => c.voice_profile_id !== voiceProfileId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clones));
}

export function getLocalCloneById(voiceProfileId: number): LocalClone | undefined {
  return getLocalClones().find((c) => c.voice_profile_id === voiceProfileId);
}

export function isLocalClone(voiceProfileId: number): boolean {
  return getLocalClones().some((c) => c.voice_profile_id === voiceProfileId);
}
