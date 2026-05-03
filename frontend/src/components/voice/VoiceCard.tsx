import { ChevronDown, ChevronUp, Globe, Lock, Pencil, Trash2 } from "lucide-react";

import type { VoiceProfileItem } from "@/types";

import { VoiceStatusBadge } from "./VoiceStatusBadge";

const TYPE_LABELS: Record<string, string> = {
  system: "系统",
  designed: "设计",
  cloned: "克隆",
};

const TYPE_STYLES: Record<string, string> = {
  system: "bg-purple-100 text-purple-700",
  designed: "bg-cyan-100 text-cyan-700",
  cloned: "bg-orange-100 text-orange-700",
};

interface VoiceCardProps {
  profile: VoiceProfileItem;
  expanded: boolean;
  onToggle: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function VoiceCard({ profile, expanded, onToggle, onEdit, onDelete }: VoiceCardProps) {
  return (
    <div className="rounded-lg border bg-white shadow-sm">
      <div
        className="flex cursor-pointer items-start gap-3 p-4 hover:bg-gray-50"
        onClick={onToggle}
      >
        <div className="flex min-h-10 min-w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
          <span className="text-sm font-bold">{profile.name[0]}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{profile.name}</span>
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                TYPE_STYLES[profile.profile_type] || "bg-gray-100 text-gray-600"
              }`}
            >
              {TYPE_LABELS[profile.profile_type] || profile.profile_type}
            </span>
            <VoiceStatusBadge status={profile.status} />
            {profile.isLocal ? (
              <span className="inline-flex items-center gap-0.5 text-xs text-amber-600">
                <Lock className="h-3 w-3" /> 本地
              </span>
            ) : (
              <span className="inline-flex items-center gap-0.5 text-xs text-emerald-600">
                <Globe className="h-3 w-3" /> 已发布
              </span>
            )}
          </div>
          {profile.description && (
            <p className="mt-1 truncate text-sm text-gray-500">{profile.description}</p>
          )}
          <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-400">
            <span>{profile.model_code}</span>
            {profile.gender_hint && <span>| {profile.gender_hint}</span>}
            {profile.age_hint && <span>| {profile.age_hint}</span>}
            {profile.language_hint && <span>| {profile.language_hint}</span>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {onEdit && (
            <button
              onClick={(event) => {
                event.stopPropagation();
                onEdit();
              }}
              className="rounded p-2 text-gray-400 hover:bg-gray-100 hover:text-blue-600"
              title="编辑"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
          {onDelete && profile.status !== "disabled" && (
            <button
              onClick={(event) => {
                event.stopPropagation();
                onDelete();
              }}
              className="rounded p-2 text-gray-400 hover:bg-gray-100 hover:text-red-600"
              title="禁用"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <span className="p-1">
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
