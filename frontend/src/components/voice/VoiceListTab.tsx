"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import type { VoiceProfileItem } from "@/types";
import { deleteVoiceProfile, listVoiceProfiles } from "@/services/voice";

import { VoiceCard } from "./VoiceCard";
import { VoiceDetailPanel } from "./VoiceDetailPanel";

export function VoiceListTab() {
  const [profiles, setProfiles] = useState<VoiceProfileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchProfiles() {
      setLoading(true);
      try {
        const data = await listVoiceProfiles();
        if (!cancelled) {
          setProfiles(data);
        }
      } catch {
        if (!cancelled) {
          setProfiles([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void fetchProfiles();

    return () => {
      cancelled = true;
    };
  }, []);

  const refreshProfiles = async () => {
    setLoading(true);
    try {
      const data = await listVoiceProfiles();
      setProfiles(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("确定要禁用这个音色吗？")) return;
    try {
      await deleteVoiceProfile(id);
      await refreshProfiles();
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (profiles.length === 0) {
    return <div className="py-12 text-center text-gray-400">暂无音色</div>;
  }

  return (
    <div className="space-y-3">
      {profiles.map((profile) => (
        <div key={profile.id}>
          <VoiceCard
            profile={profile}
            expanded={expandedId === profile.id}
            onToggle={() =>
              setExpandedId((current) => (current === profile.id ? null : profile.id))
            }
            onDelete={() => void handleDelete(profile.id)}
          />
          {expandedId === profile.id && (
            <VoiceDetailPanel
              profileId={profile.id}
              profileType={profile.profile_type}
              onClose={() => setExpandedId(null)}
              onUpdated={() => void refreshProfiles()}
            />
          )}
        </div>
      ))}
    </div>
  );
}
