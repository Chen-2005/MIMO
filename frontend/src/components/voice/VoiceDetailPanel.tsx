"use client";

import { useEffect, useState } from "react";
import { Globe, Loader2, Lock, Volume2 } from "lucide-react";

import { AudioPlayer } from "@/components/tts/AudioPlayer";
import { resolveBaseUrl } from "@/services/api";
import { removeLocalClone } from "@/services/localClones";
import { createTask, getTask, getTaskAudioUrl } from "@/services/tts";
import {
  getCloneSource,
  getVoiceProfile,
  updateVoiceProfile,
} from "@/services/voice";
import type { CloneSourceDetail, VoiceProfileDetail } from "@/types";

import { VoiceStatusBadge } from "./VoiceStatusBadge";

interface VoiceDetailPanelProps {
  profileId: number;
  profileType: string;
  isLocal?: boolean;
  onClose: () => void;
  onUpdated: () => void;
  onUseForClone?: (audioUrl: string) => void;
}

export function VoiceDetailPanel({
  profileId,
  profileType,
  isLocal = false,
  onClose,
  onUpdated,
  onUseForClone,
}: VoiceDetailPanelProps) {
  const [detail, setDetail] = useState<VoiceProfileDetail | null>(null);
  const [cloneSource, setCloneSource] = useState<CloneSourceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    gender_hint: "",
    age_hint: "",
    language_hint: "",
  });
  const [saving, setSaving] = useState(false);
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchDetail() {
      setLoading(true);
      try {
        const profile = await getVoiceProfile(profileId);
        if (cancelled) return;

        setDetail(profile);
        setEditForm({
          name: profile.name,
          description: profile.description || "",
          gender_hint: profile.gender_hint || "",
          age_hint: profile.age_hint || "",
          language_hint: profile.language_hint || "",
        });

        if (profileType === "cloned") {
          try {
            const source = await getCloneSource(profileId);
            if (!cancelled) {
              setCloneSource(source);
            }
          } catch {
            if (!cancelled) {
              setCloneSource(null);
            }
          }
        } else {
          setCloneSource(null);
        }
      } catch {
        if (!cancelled) {
          setDetail(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void fetchDetail();

    return () => {
      cancelled = true;
    };
  }, [profileId, profileType]);

  const refreshDetail = async () => {
    setLoading(true);
    try {
      const profile = await getVoiceProfile(profileId);
      setDetail(profile);
      setEditForm({
        name: profile.name,
        description: profile.description || "",
        gender_hint: profile.gender_hint || "",
        age_hint: profile.age_hint || "",
        language_hint: profile.language_hint || "",
      });

      if (profileType === "cloned") {
        try {
          const source = await getCloneSource(profileId);
          setCloneSource(source);
        } catch {
          setCloneSource(null);
        }
      } else {
        setCloneSource(null);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateVoiceProfile(profileId, editForm);
      setEditing(false);
      await refreshDetail();
      onUpdated();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    if (!detail) return;

    setPreviewLoading(true);
    setPreviewAudioUrl(null);

    try {
      const requestId = `preview-${detail.id}-${Date.now()}`;
      const previewText = "你好，这是一段音色试听。今天的声音表现稳定、自然，也适合做长文本播报。";
      const task = await createTask({
        request_id: requestId,
        text: previewText,
        model_code: "MiMo-V2.5-TTS",
        voice_profile_id: detail.id,
      });

      for (let i = 0; i < 30; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const currentTask = await getTask(task.task_id);
        if (currentTask.status === "succeeded" && currentTask.audio_url) {
          setPreviewAudioUrl(getTaskAudioUrl(task.task_id));
          break;
        }
        if (currentTask.status === "failed" || currentTask.status === "canceled") {
          break;
        }
      }
    } catch {
      // ignore
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleTogglePublish = async (publish: boolean) => {
    if (!detail) return;
    setPublishing(true);
    try {
      await updateVoiceProfile(profileId, { is_public: publish ? 1 : 0 });
      if (publish && isLocal) {
        removeLocalClone(profileId);
      }
      await refreshDetail();
      onUpdated();
    } catch {
      // ignore
    } finally {
      setPublishing(false);
    }
  };

  const formatDate = (value?: string) => {
    if (!value) return "-";
    return new Date(value).toLocaleString("zh-CN");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!detail) {
    return <div className="py-4 text-sm text-gray-400">加载失败</div>;
  }

  return (
    <div className="border-t bg-gray-50 px-4 py-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-semibold">音色详情</h3>
        <div className="flex flex-wrap gap-2">
          {detail.status === "active" && (
            <button
              onClick={() => void handlePreview()}
              disabled={previewLoading}
              className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Volume2 className="h-3.5 w-3.5" />
              {previewLoading ? "生成中..." : "试听"}
            </button>
          )}
          {!editing && detail.status === "active" && (
            <button
              onClick={() => setEditing(true)}
              className="rounded-lg border px-3 py-2 text-xs text-gray-600 hover:bg-white"
            >
              编辑
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-lg border px-3 py-2 text-xs text-gray-600 hover:bg-white"
          >
            收起
          </button>
        </div>
      </div>

      {editing ? (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-gray-500">名称</label>
            <input
              value={editForm.name}
              onChange={(event) =>
                setEditForm((current) => ({ ...current, name: event.target.value }))
              }
              className="w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">描述</label>
            <textarea
              value={editForm.description}
              onChange={(event) =>
                setEditForm((current) => ({ ...current, description: event.target.value }))
              }
              rows={2}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs text-gray-500">性别</label>
              <input
                value={editForm.gender_hint}
                onChange={(event) =>
                  setEditForm((current) => ({ ...current, gender_hint: event.target.value }))
                }
                placeholder="male / female"
                className="w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">年龄</label>
              <input
                value={editForm.age_hint}
                onChange={(event) =>
                  setEditForm((current) => ({ ...current, age_hint: event.target.value }))
                }
                placeholder="young / adult / elderly"
                className="w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">语言</label>
              <input
                value={editForm.language_hint}
                onChange={(event) =>
                  setEditForm((current) => ({ ...current, language_hint: event.target.value }))
                }
                placeholder="zh / en"
                className="w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => void handleSave()}
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "保存中..." : "保存"}
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setEditForm({
                  name: detail.name,
                  description: detail.description || "",
                  gender_hint: detail.gender_hint || "",
                  age_hint: detail.age_hint || "",
                  language_hint: detail.language_hint || "",
                });
              }}
              className="rounded-lg border px-4 py-1.5 text-xs text-gray-600 hover:bg-white"
            >
              取消
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2 text-sm">
          <div className="grid grid-cols-1 gap-x-8 gap-y-1 sm:grid-cols-2">
            <div>
              <span className="text-gray-500">ID:</span> {detail.id}
            </div>
            <div>
              <span className="text-gray-500">状态:</span> <VoiceStatusBadge status={detail.status} />
            </div>
            <div>
              <span className="text-gray-500">类型:</span> {detail.profile_type}
            </div>
            <div>
              <span className="text-gray-500">模型:</span> {detail.model_code}
            </div>
            {detail.provider_voice_id && (
              <div>
                <span className="text-gray-500">Provider ID:</span>{" "}
                <span className="font-mono text-xs">{detail.provider_voice_id}</span>
              </div>
            )}
            {detail.gender_hint && (
              <div>
                <span className="text-gray-500">性别:</span> {detail.gender_hint}
              </div>
            )}
            {detail.age_hint && (
              <div>
                <span className="text-gray-500">年龄:</span> {detail.age_hint}
              </div>
            )}
            {detail.language_hint && (
              <div>
                <span className="text-gray-500">语言:</span> {detail.language_hint}
              </div>
            )}
            <div>
              <span className="text-gray-500">可见性:</span>{" "}
              {isLocal ? (
                <span className="inline-flex items-center gap-1 text-amber-600">
                  <Lock className="h-3 w-3" /> 本地未发布
                </span>
              ) : detail.is_public === 1 ? (
                <span className="inline-flex items-center gap-1 text-emerald-600">
                  <Globe className="h-3 w-3" /> 已发布
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-gray-400">
                  <Lock className="h-3 w-3" /> 仅自己
                </span>
              )}
            </div>
            <div>
              <span className="text-gray-500">创建时间:</span> {formatDate(detail.created_at)}
            </div>
          </div>
          {detail.description && (
            <div>
              <span className="text-gray-500">描述:</span> {detail.description}
            </div>
          )}
          {profileType === "designed" && detail.audio_url && (
            <div className="mt-3 border-t pt-3">
              <p className="mb-2 text-xs text-gray-500">设计样本音频</p>
              <AudioPlayer src={`${resolveBaseUrl()}${detail.audio_url}`} />
              {onUseForClone && (
                <button
                  onClick={() => onUseForClone(`${resolveBaseUrl()}${detail.audio_url}`)}
                  className="mt-2 flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs text-white hover:bg-blue-700"
                >
                  用此音色克隆
                </button>
              )}
            </div>
          )}
          {previewAudioUrl && (
            <div className="mt-3 border-t pt-3">
              <p className="mb-2 text-xs text-gray-500">试听音频</p>
              <AudioPlayer src={previewAudioUrl} />
              {detail.status === "active" && (
                <div className="mt-3 flex gap-2">
                  {detail.is_public === 0 ? (
                    <button
                      onClick={() => void handleTogglePublish(true)}
                      disabled={publishing}
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <Globe className="h-3.5 w-3.5" />
                      {publishing ? "发布中..." : "发布音色"}
                    </button>
                  ) : (
                    <button
                      onClick={() => void handleTogglePublish(false)}
                      disabled={publishing}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-xs text-slate-600 hover:bg-white disabled:opacity-50"
                    >
                      <Lock className="h-3.5 w-3.5" />
                      {publishing ? "处理中..." : "取消发布"}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {profileType === "cloned" && cloneSource && (
        <div className="mt-4 border-t pt-4">
          <h4 className="mb-2 text-sm font-semibold">克隆源信息</h4>
          <div className="space-y-1 text-sm">
            <div>
              <span className="text-gray-500">源音频:</span>{" "}
              <span className="break-all font-mono text-xs">{cloneSource.source_audio_url}</span>
            </div>
            <div>
              <span className="text-gray-500">授权类型:</span> {cloneSource.consent_type}
            </div>
            <div>
              <span className="text-gray-500">授权声明:</span> {cloneSource.consent_statement}
            </div>
            <div>
              <span className="text-gray-500">审核状态:</span> {cloneSource.risk_status}
            </div>
            {cloneSource.review_note && (
              <div>
                <span className="text-gray-500">审核备注:</span> {cloneSource.review_note}
              </div>
            )}
            {cloneSource.consent_proof_url && (
              <div>
                <span className="text-gray-500">授权证明:</span>{" "}
                <a
                  href={cloneSource.consent_proof_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline"
                >
                  查看
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
