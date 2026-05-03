"use client";

import { useEffect, useState } from "react";

import { listVoiceProfiles } from "@/services/voice";
import type { VoiceProfileItem } from "@/types";

const TYPE_LABELS: Record<string, string> = {
  system: "系统",
  designed: "设计",
  cloned: "克隆",
};

interface VoiceSelectorProps {
  value: number | null;
  onChange: (value: number | null) => void;
  profileType?: string;
}

export function VoiceSelector({
  value,
  onChange,
  profileType,
}: VoiceSelectorProps) {
  const [voices, setVoices] = useState<VoiceProfileItem[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function fetchVoices() {
      try {
        const data = await listVoiceProfiles(profileType);
        if (!cancelled) {
          setVoices(data.filter((v) => v.status === "active"));
        }
      } catch {
        if (!cancelled) {
          setVoices([]);
        }
      }
    }

    void fetchVoices();

    return () => {
      cancelled = true;
    };
  }, [profileType]);

  const grouped = voices.reduce<Record<string, VoiceProfileItem[]>>((acc, voice) => {
    const key = voice.profile_type;
    if (!acc[key]) acc[key] = [];
    acc[key].push(voice);
    return acc;
  }, {});

  const typeOrder = ["system", "designed", "cloned"];

  return (
    <select
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)}
      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
    >
      <option value="">默认音色</option>
      {typeOrder.map((type) => {
        const items = grouped[type];
        if (!items || items.length === 0) return null;
        return (
          <optgroup key={type} label={TYPE_LABELS[type] || type}>
            {items.map((voice) => (
              <option key={voice.id} value={voice.id}>
                {voice.name}
              </option>
            ))}
          </optgroup>
        );
      })}
    </select>
  );
}
