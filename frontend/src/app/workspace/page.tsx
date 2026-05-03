"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  AudioLines,
  Loader2,
  RotateCcw,
  Mic2,
} from "lucide-react";

import { TaskStatusBadge } from "@/components/common/TaskStatusBadge";
import { AudioPlayer } from "@/components/tts/AudioPlayer";
import { ModelSelector } from "@/components/tts/ModelSelector";
import { StyleControls } from "@/components/tts/StyleControls";
import { TextInput } from "@/components/tts/TextInput";
import { VoiceSelector } from "@/components/tts/VoiceSelector";
import { VoiceCloneTab } from "@/components/voice/VoiceCloneTab";
import { getTaskAudioUrl } from "@/services/tts";
import { resolveBaseUrl } from "@/services/api";
import { formatDuration } from "@/lib/utils";
import { useTTSStore } from "@/stores/tts-store";

const GENERATION_TABS = [
  {
    key: "system",
    label: "预置音色生成",
    description: "选择系统音色，直接生成语音。",
    icon: AudioLines,
  },
  {
    key: "clone",
    label: "音色克隆生成",
    description: "上传样本后，直接生成本次语音。",
    icon: Mic2,
  },
] as const;

export default function WorkspacePage() {
  const store = useTTSStore();
  const [cloneAudioUrl, setCloneAudioUrl] = useState<string | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<"system" | "clone">("system");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nextCloneAudioUrl = params.get("cloneAudioUrl") || undefined;
    setCloneAudioUrl(nextCloneAudioUrl);
    void store.loadRecentTasks();
  }, []);

  useEffect(() => {
    if (cloneAudioUrl) {
      setActiveTab("clone");
    }
  }, [cloneAudioUrl]);

  const handleGenerate = () => {
    if (!store.text.trim() || store.isGenerating) return;
    void store.generate();
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-6 sm:py-5">
        <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">语音生成</h1>
        <p className="mt-2 text-sm text-slate-500">
          在一个页面里完成文本输入、音色选择、生成和试听。
        </p>
      </section>

      <div className="rounded-[24px] border border-slate-200 bg-white p-2 sm:p-3 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2">
          {GENERATION_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-[20px] border px-4 py-4 text-left transition-all ${
                  active
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`rounded-2xl p-2 ${
                      active ? "bg-white/10 text-white" : "bg-white text-slate-700"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="font-semibold">{tab.label}</div>
                    <p
                      className={`text-sm leading-6 ${
                        active ? "text-slate-200" : "text-slate-500"
                      }`}
                    >
                      {tab.description}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === "system" ? (
        <div className="space-y-6">
          <section className="rounded-[24px] border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">生成内容</h2>
                <p className="mt-1 text-sm text-slate-500">
                  先写文本，再选择模型与音色。
                </p>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                预置音色
              </div>
            </div>
            <TextInput
              value={store.text}
              onChange={(value) => store.setField("text", value)}
            />
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-[24px] border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">模型与音色</h2>
              <p className="mt-1 text-sm text-slate-500">
                主模型优先效果，备用模型用于降级回退。
              </p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                    模型
                  </label>
                  <ModelSelector
                    value={store.modelCode}
                    onChange={(value) => store.setField("modelCode", value)}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                    音色
                  </label>
                  <VoiceSelector
                    value={store.voiceProfileId}
                    onChange={(value) => store.setField("voiceProfileId", value)}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">风格与参数</h2>
              <p className="mt-1 text-sm text-slate-500">
                默认已经偏自然，你也可以继续微调。
              </p>
              <div className="mt-5">
                <StyleControls
                  stylePrompt={store.stylePrompt}
                  onStylePromptChange={(value) => store.setField("stylePrompt", value)}
                  speed={store.speed}
                  onSpeedChange={(value) => store.setField("speed", value)}
                  outputFormat={store.outputFormat}
                  onOutputFormatChange={(value) => store.setField("outputFormat", value)}
                />
              </div>
            </div>
          </section>

          <section className="rounded-[24px] border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900">生成语音</h2>
              <p className="mt-1 text-sm text-slate-500">
                检查文本和参数后直接生成。
              </p>
            </div>

            <button
              onClick={handleGenerate}
              disabled={!store.text.trim() || store.isGenerating}
              className="flex w-full items-center justify-center gap-2 rounded-[18px] bg-slate-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {store.isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  生成中...
                </>
              ) : (
                "生成语音"
              )}
            </button>

            {/* Result / Error inline */}
            {store.error && (
              <div className="mt-4 flex items-start gap-2 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <div>
                  <p>{store.error}</p>
                  <button
                    onClick={handleGenerate}
                    className="mt-3 flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-800"
                  >
                    <RotateCcw className="h-3 w-3" />
                    重试
                  </button>
                </div>
              </div>
            )}

            {store.isGenerating && !store.currentTask && (
              <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-8 text-sm text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin" />
                正在生成，请稍候...
              </div>
            )}

            {store.currentTask && (
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500">任务状态</span>
                    <TaskStatusBadge status={store.currentTask.status} />
                    {store.currentTask.fallback_used && (
                      <span className="text-xs text-orange-500">已触发降级</span>
                    )}
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-slate-400">
                    <div>任务号：{store.currentTask.task_no}</div>
                    {store.currentTask.segment_count > 0 && (
                      <div>分段数：{store.currentTask.segment_count}</div>
                    )}
                  </div>
                </div>

                {store.currentTask.status === "succeeded" && store.currentTask.audio_url && (
                  <AudioPlayer
                    src={`${resolveBaseUrl()}${store.currentTask.audio_url}`}
                    durationMs={store.currentTask.audio_duration_ms}
                    downloadUrl={getTaskAudioUrl(store.currentTask.task_id)}
                  />
                )}
              </div>
            )}

            {store.recentTasks.length > 0 && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400">最近生成</span>
                  <button
                    onClick={store.clearRecentTasks}
                    className="text-xs text-slate-400 hover:text-slate-600"
                  >
                    清空
                  </button>
                </div>
                {store.recentTasks.map((task) => (
                  <div
                    key={task.task_id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <TaskStatusBadge status={task.status} />
                      <span className="text-xs text-slate-400">{task.task_no}</span>
                      {task.audio_duration_ms && (
                        <span className="ml-auto text-xs text-slate-400">
                          {formatDuration(task.audio_duration_ms)}
                        </span>
                      )}
                    </div>
                    {task.status === "succeeded" && task.audio_url && (
                      <AudioPlayer
                        src={`${resolveBaseUrl()}${task.audio_url}`}
                        durationMs={task.audio_duration_ms}
                        downloadUrl={getTaskAudioUrl(task.task_id)}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : (
        <VoiceCloneTab embedded initialAudioUrl={cloneAudioUrl} />
      )}
    </div>
  );
}
