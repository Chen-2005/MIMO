"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2, Mic, Plus, Square, Trash2, Upload } from "lucide-react";

import { AudioPlayer } from "@/components/tts/AudioPlayer";
import { resolveBaseUrl } from "@/services/api";
import {
  getLocalClones,
  removeLocalClone,
  saveLocalClone,
} from "@/services/localClones";
import { createTask, getTask, getTaskAudioUrl } from "@/services/tts";
import {
  createVoiceClone,
  deleteVoiceProfile,
  getVoiceProfile,
  listVoiceProfiles,
  uploadVoiceCloneAudio,
} from "@/services/voice";
import type { TaskDetail, VoiceProfileItem } from "@/types";

import { VoiceCard } from "./VoiceCard";
import { VoiceDetailPanel } from "./VoiceDetailPanel";

const CLONE_DEFAULT_STYLE =
  "自然、平稳、像真人讲解，停顿自然，不要播音腔，不要夸张。";

type AudioMode = "upload" | "record";
type SubmitStage = "idle" | "uploading" | "cloning" | "waiting_clone" | "generating";

interface VoiceCloneTabProps {
  embedded?: boolean;
  initialAudioUrl?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function buildRequestId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function VoiceCloneTab({ embedded = false, initialAudioUrl }: VoiceCloneTabProps) {
  const [profiles, setProfiles] = useState<VoiceProfileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(embedded);
  const [form, setForm] = useState({
    name: "",
    source_audio_url: "",
    text: "",
    one_time_only: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitStage, setSubmitStage] = useState<SubmitStage>("idle");
  const [error, setError] = useState("");
  const [resultMessage, setResultMessage] = useState("");
  const [generatedTask, setGeneratedTask] = useState<TaskDetail | null>(null);

  const [audioMode, setAudioMode] = useState<AudioMode>("upload");
  const [audioDataUrl, setAudioDataUrl] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioFileName, setAudioFileName] = useState("");
  const [audioFileSize, setAudioFileSize] = useState(0);
  const [showAdvancedUrl, setShowAdvancedUrl] = useState(false);

  const [recording, setRecording] = useState(false);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mergeProfiles = (backend: VoiceProfileItem[]): VoiceProfileItem[] => {
    const localClones = getLocalClones();
    const localItems: VoiceProfileItem[] = localClones.map((lc) => ({
      id: lc.voice_profile_id,
      profile_type: "cloned",
      name: lc.name,
      model_code: lc.model_code,
      provider_voice_id: lc.provider_voice_id,
      status: "active",
      isLocal: true,
    }));
    const backendItems = backend.filter(
      (b) => !localClones.some((lc) => lc.voice_profile_id === b.id),
    );
    return [...localItems, ...backendItems];
  };

  useEffect(() => {
    let cancelled = false;

    async function fetchProfiles() {
      setLoading(true);
      try {
        const data = await listVoiceProfiles("cloned");
        if (!cancelled) {
          setProfiles(mergeProfiles(data));
        }
      } catch {
        if (!cancelled) {
          setProfiles(mergeProfiles([]));
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

  useEffect(() => {
    if (initialAudioUrl) {
      setShowAdvancedUrl(true);
      setForm((current) => ({ ...current, source_audio_url: initialAudioUrl }));
      setShowForm(true);
    }
  }, [initialAudioUrl]);

  const refreshProfiles = async () => {
    setLoading(true);
    try {
      const data = await listVoiceProfiles("cloned");
      setProfiles(mergeProfiles(data));
    } catch {
      setProfiles(mergeProfiles([]));
    } finally {
      setLoading(false);
    }
  };

  const getResolvedAudioUrl = useCallback((): string => {
    if (showAdvancedUrl && form.source_audio_url.trim()) {
      return form.source_audio_url.trim();
    }
    return audioDataUrl;
  }, [audioDataUrl, form.source_audio_url, showAdvancedUrl]);

  const clearAudio = () => {
    setAudioDataUrl("");
    setAudioFile(null);
    setAudioFileName("");
    setAudioFileSize(0);
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
      setRecordedUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError("");
    setResultMessage("");
    setGeneratedTask(null);
    setAudioFile(file);
    setAudioFileName(file.name);
    setAudioFileSize(file.size);
    setAudioDataUrl("");

    const reader = new FileReader();
    reader.onload = () => {
      setAudioDataUrl(reader.result as string);
    };
    reader.onerror = () => {
      setError("音频文件读取失败");
    };
    reader.readAsDataURL(file);
  };

  const startRecording = async () => {
    setError("");
    setResultMessage("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: mediaRecorder.mimeType || "audio/webm",
        });
        const objectUrl = URL.createObjectURL(blob);
        setRecordedUrl(objectUrl);

        const file = new File([blob], `voice-clone-${Date.now()}.webm`, {
          type: blob.type || "audio/webm",
        });
        setAudioFile(file);
        setAudioFileName(file.name);
        setAudioFileSize(file.size);

        const reader = new FileReader();
        reader.onload = () => {
          setAudioDataUrl(reader.result as string);
        };
        reader.readAsDataURL(blob);

        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setRecording(true);
      setAudioDataUrl("");
      setRecordedUrl(null);
      setAudioFile(null);
      setAudioFileName("");
      setAudioFileSize(0);
    } catch {
      setError("麦克风不可用，请检查浏览器权限或 HTTPS 配置");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const waitForClonedProfile = async (profileId: number): Promise<VoiceProfileItem> => {
    for (let i = 0; i < 90; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      try {
        const current = await getVoiceProfile(profileId);
        if (current.status === "active") {
          return current;
        }
        if (current.status === "rejected" || current.status === "disabled") {
          throw new Error("音色克隆失败，请检查样本质量或后端日志");
        }
      } catch (err) {
        if (err instanceof Error && err.message.includes("克隆失败")) throw err;
      }
    }
    throw new Error("等待音色克隆完成超时，请稍后在列表中查看");
  };

  const waitForTask = async (taskId: number): Promise<TaskDetail> => {
    for (let i = 0; i < 120; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const task = await getTask(taskId);
      setGeneratedTask(task);
      if (task.status !== "queued" && task.status !== "running") {
        return task;
      }
    }
    throw new Error("等待语音生成完成超时，请到历史记录查看任务");
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      return;
    }

    setError("");
    setResultMessage("");
    setGeneratedTask(null);
    setSubmitting(true);

    try {
      let sourceAudioUrl = getResolvedAudioUrl();

      if (!showAdvancedUrl && audioFile) {
        setSubmitStage("uploading");
        const uploaded = await uploadVoiceCloneAudio(audioFile);
        sourceAudioUrl = uploaded.source_audio_url;
      }

      if (!sourceAudioUrl) {
        throw new Error("请先准备音频样本");
      }

      setSubmitStage("cloning");
      const cloneResult = await createVoiceClone({
        name: form.name.trim(),
        model_code: "MiMo-V2.5-TTS-VoiceClone",
        source_audio_url: sourceAudioUrl,
      });

      setSubmitStage("waiting_clone");
      const activeProfile = await waitForClonedProfile(cloneResult.voice_profile_id);

      saveLocalClone({
        voice_profile_id: activeProfile.id,
        provider_voice_id: activeProfile.provider_voice_id || "",
        name: activeProfile.name,
        model_code: activeProfile.model_code,
        source_audio_url: sourceAudioUrl,
        consent_type: "internal_use",
        consent_statement: "internal_use",
        created_at: new Date().toISOString(),
      });

      if (form.text.trim()) {
        setSubmitStage("generating");
        const created = await createTask({
          request_id: buildRequestId("clone_once"),
          text: form.text.trim(),
          model_code: "MiMo-V2.5-TTS",
          voice_profile_id: activeProfile.id,
          style_prompt: CLONE_DEFAULT_STYLE,
          speed: 0.9,
          output_format: "wav",
          enable_fallback: true,
        });

        const finalTask = await waitForTask(created.task_id);
        if (finalTask.status === "failed") {
          throw new Error(finalTask.provider_error_message || "文本转语音失败");
        }

        if (form.one_time_only) {
          removeLocalClone(activeProfile.id);
          await deleteVoiceProfile(activeProfile.id);
        }

        setResultMessage(
          form.one_time_only
            ? "音色克隆成功，本次语音也已生成，并且该音色已按一次性模式自动移除。"
            : "音色克隆成功，并已为本次文本生成语音。"
        );
      } else {
        setResultMessage("音色克隆成功");
      }

      setForm({
        name: "",
        source_audio_url: "",
        text: "",
        one_time_only: true,
      });
      clearAudio();
      setShowAdvancedUrl(false);
      if (!embedded) {
        setShowForm(false);
      }
      await refreshProfiles();
    } catch (errorValue: unknown) {
      setError(errorValue instanceof Error ? errorValue.message : "提交失败");
    } finally {
      setSubmitStage("idle");
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("确定要禁用这个克隆音色吗？")) return;
    try {
      removeLocalClone(id);
      await deleteVoiceProfile(id);
      await refreshProfiles();
    } catch {
      await refreshProfiles();
    }
  };

  const hasAudio = audioDataUrl.length > 0;
  const canSubmit =
    form.name.trim().length > 0 &&
    (hasAudio || (showAdvancedUrl && form.source_audio_url.trim().length > 0));

  const submitLabel =
    submitStage === "uploading"
      ? "上传音频中..."
      : submitStage === "cloning"
        ? "提交克隆中..."
        : submitStage === "waiting_clone"
          ? "等待克隆完成..."
          : submitStage === "generating"
            ? "生成语音中..."
            : "提交克隆申请";

  const containerClassName = embedded
    ? "space-y-6"
    : "space-y-4";

  return (
    <div className={containerClassName}>
      {!embedded && (
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">音色克隆</h3>
          <button
            onClick={() => setShowForm((current) => !current)}
            className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700"
          >
            <Plus className="h-3.5 w-3.5" />
            新建克隆申请
          </button>
        </div>
      )}

      {embedded && (
        <section className="rounded-[24px] border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">音色克隆生成</h2>
              <p className="mt-1 text-sm text-slate-500">上传样本后，直接为本次文本生成语音。</p>
            </div>
            <button
              onClick={() => setShowForm((current) => !current)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-[16px] bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 sm:w-auto"
            >
              <Plus className="h-4 w-4" />
              {showForm ? "收起表单" : "新建克隆"}
            </button>
          </div>
        </section>
      )}

      {showForm && (
        <section
          className={`space-y-5 border p-4 shadow-sm sm:p-5 ${
            embedded
              ? "rounded-[24px] border-slate-200 bg-white"
              : "rounded-lg border bg-white"
          }`}
        >
          {error && (
            <div className="rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
          )}
          {resultMessage && (
            <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {resultMessage}
            </div>
          )}

          <div className={embedded ? "grid gap-6 xl:grid-cols-[1.2fr_0.8fr]" : "space-y-5"}>
            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                  音色名称
                </label>
                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="例如：本次视频配音"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-3 block text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                  音频样本
                </label>
                <div className="mb-3 flex gap-1 rounded-2xl bg-slate-100 p-1">
                  <button
                    onClick={() => setAudioMode("upload")}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-[14px] px-3 py-2 text-xs font-medium transition-colors ${
                      audioMode === "upload"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    上传文件
                  </button>
                  <button
                    onClick={() => setAudioMode("record")}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-[14px] px-3 py-2 text-xs font-medium transition-colors ${
                      audioMode === "record"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    <Mic className="h-3.5 w-3.5" />
                    直接录音
                  </button>
                </div>

                {audioMode === "upload" && (
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="audio/*,.wav,.mp3,.m4a,.ogg,.flac,.webm"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    {!hasAudio ? (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex w-full items-center justify-center gap-2 rounded-[20px] border-2 border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500 hover:border-blue-400 hover:text-blue-600 sm:py-9"
                      >
                        <Upload className="h-5 w-5" />
                        选择本地音频文件
                      </button>
                    ) : (
                      <div className="space-y-2 rounded-[20px] border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-center justify-between">
                          <div className="text-sm">
                            <span className="font-medium text-slate-700">{audioFileName}</span>
                            <span className="ml-2 text-slate-400">
                              {formatFileSize(audioFileSize)}
                            </span>
                          </div>
                          <button
                            onClick={clearAudio}
                            className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-red-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <audio controls src={audioDataUrl} className="w-full" />
                      </div>
                    )}
                  </div>
                )}

                {audioMode === "record" && (
                  <div className="space-y-3">
                    {!recording && !hasAudio && (
                      <button
                        onClick={() => void startRecording()}
                        className="flex w-full items-center justify-center gap-2 rounded-[20px] border-2 border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500 hover:border-red-400 hover:text-red-600 sm:py-9"
                      >
                        <Mic className="h-5 w-5" />
                        开始录制样本
                      </button>
                    )}
                    {recording && (
                      <div className="flex flex-col items-center gap-3 rounded-[20px] border border-red-100 bg-red-50 p-4">
                        <div className="flex items-center gap-2 text-sm text-red-600">
                          <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                          正在录音...
                        </div>
                        <button
                          onClick={stopRecording}
                          className="flex items-center gap-1.5 rounded-xl bg-red-600 px-5 py-2.5 text-sm text-white hover:bg-red-700"
                        >
                          <Square className="h-4 w-4" />
                          停止录音
                        </button>
                      </div>
                    )}
                    {!recording && hasAudio && (
                      <div className="space-y-2 rounded-[20px] border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-slate-700">录音样本</span>
                          <button
                            onClick={clearAudio}
                            className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-red-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <audio controls src={recordedUrl ?? audioDataUrl} className="w-full" />
                        <button
                          onClick={() => {
                            clearAudio();
                            void startRecording();
                          }}
                          className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-xs text-slate-600 hover:bg-slate-100"
                        >
                          重新录制
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <button
                  onClick={() => setShowAdvancedUrl((current) => !current)}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"
                >
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${
                      showAdvancedUrl ? "rotate-180" : ""
                    }`}
                  />
                  高级方式：直接填写音频 URL / data URL
                </button>
                {showAdvancedUrl && (
                  <div className="mt-2">
                    <input
                      value={form.source_audio_url}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          source_audio_url: event.target.value,
                        }))
                      }
                      placeholder="https://... 或 data:audio/..."
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                  本次要生成的文本
                </label>
                <textarea
                  value={form.text}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, text: event.target.value }))
                  }
                  placeholder="克隆成功后，会直接用这个声音生成这一次的文本语音。"
                  rows={8}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  系统会默认按“自然讲解 + 0.9x 语速”生成。想更顺畅时，建议把文本写成短句，并保留清晰标点。
                </p>
              </div>

              <label className="flex items-start gap-3 rounded-[18px] border border-slate-200 bg-slate-50 px-3 py-3.5 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.one_time_only}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      one_time_only: event.target.checked,
                    }))
                  }
                  className="mt-0.5"
                />
                <span>
                  仅本次使用
                  <span className="mt-1 block text-xs leading-5 text-slate-400">
                    勾选后，如果本次文本生成成功，这个克隆音色会自动从长期列表中移除，不作为固定音色保留。
                  </span>
                </span>
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              onClick={() => void handleSubmit()}
              disabled={submitting || !canSubmit}
              className={`w-full rounded-[16px] px-4 py-3 text-sm font-medium text-white disabled:opacity-50 sm:w-auto ${
                embedded ? "bg-slate-900 hover:bg-slate-800" : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {submitting ? submitLabel : "提交克隆申请"}
            </button>
            {!embedded && (
              <button
                onClick={() => {
                  setShowForm(false);
                  setError("");
                  setResultMessage("");
                  clearAudio();
                  setShowAdvancedUrl(false);
                }}
                className="w-full rounded-[16px] border border-slate-300 px-4 py-3 text-sm text-slate-600 hover:bg-slate-50 sm:w-auto"
              >
                取消
              </button>
            )}
          </div>

          {generatedTask && (
            <div className="space-y-3 rounded-[20px] border border-blue-100 bg-blue-50 px-3 py-3">
              <div className="text-xs leading-5 text-blue-700">
                已创建本次语音任务，任务 ID：{generatedTask.task_id}，当前状态：{generatedTask.status}
              </div>
              {generatedTask.status === "succeeded" && generatedTask.audio_url && (
                <AudioPlayer
                  src={`${resolveBaseUrl()}${generatedTask.audio_url}`}
                  durationMs={generatedTask.audio_duration_ms}
                  downloadUrl={getTaskAudioUrl(generatedTask.task_id)}
                />
              )}
            </div>
          )}
        </section>
      )}

      <section
        className={`space-y-4 ${
          embedded ? "rounded-[24px] border border-slate-200 bg-white p-4 sm:p-6 shadow-sm" : ""
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className={embedded ? "text-lg font-semibold text-slate-900" : "text-sm font-semibold text-gray-700"}>
              已有克隆音色
            </h3>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : profiles.length === 0 ? (
          <div
            className={`py-12 text-center text-gray-400 ${
              embedded ? "rounded-[20px] border border-dashed border-slate-200 bg-slate-50" : ""
            }`}
          >
            还没有克隆音色，先提交一个样本试试。
          </div>
        ) : (
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
                    isLocal={profile.isLocal}
                    onClose={() => setExpandedId(null)}
                    onUpdated={() => void refreshProfiles()}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
