import { create } from "zustand";
import { createTask, getTask, listTasks } from "@/services/tts";
import type { TaskDetail, TaskListItem } from "@/types";

const MAX_RECENT_TASKS = 5;

interface TTSState {
  // Form fields
  text: string;
  modelCode: string;
  voiceProfileId: number | null;
  stylePrompt: string;
  speed: number;
  outputFormat: string;

  // Task state
  currentTask: TaskDetail | null;
  isGenerating: boolean;
  error: string | null;

  // History
  recentTasks: TaskListItem[];

  // Actions
  setField: <K extends keyof TTSState>(key: K, value: TTSState[K]) => void;
  generate: () => Promise<void>;
  reset: () => void;
  addRecentTask: (task: TaskListItem) => void;
  clearRecentTasks: () => void;
  loadRecentTasks: () => Promise<void>;
}

const INITIAL_STATE = {
  text: "",
  modelCode: "MiMo-V2.5-TTS",
  voiceProfileId: null,
  stylePrompt: "自然、平稳、像真人讲解，停顿自然，不要播音腔，不要夸张。",
  speed: 0.9,
  outputFormat: "mp3",
  currentTask: null,
  isGenerating: false,
  error: null,
  recentTasks: [] as TaskListItem[],
};

export const useTTSStore = create<TTSState>((set, get) => ({
  ...INITIAL_STATE,

  setField: (key, value) => set({ [key]: value } as Partial<TTSState>),

  addRecentTask: (task) =>
    set((state) => ({
      recentTasks: [task, ...state.recentTasks].slice(0, MAX_RECENT_TASKS),
    })),

  clearRecentTasks: () => set({ recentTasks: [] }),

  loadRecentTasks: async () => {
    try {
      const result = await listTasks({ page: 1, page_size: MAX_RECENT_TASKS });
      set({ recentTasks: result.list });
    } catch {
      // ignore
    }
  },

  generate: async () => {
    const { text, modelCode, voiceProfileId, stylePrompt, speed, outputFormat } = get();
    if (!text.trim()) return;

    set({ isGenerating: true, error: null, currentTask: null });

    try {
      const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const created = await createTask({
        request_id: requestId,
        text: text.trim(),
        model_code: modelCode,
        voice_profile_id: voiceProfileId ?? undefined,
        style_prompt: stylePrompt || undefined,
        speed,
        output_format: outputFormat,
        enable_fallback: true,
      });

      // Poll for completion
      let task: TaskDetail | null = null;
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        task = await getTask(created.task_id);
        set({ currentTask: task });
        if (task.status !== "queued" && task.status !== "running") break;
      }

      if (!task) throw new Error("Task polling timed out");
      if (task.status === "failed") {
        set({ error: task.provider_error_message || "Generation failed" });
      } else if (task.status === "succeeded") {
        get().addRecentTask({
          task_id: task.task_id,
          task_no: task.task_no,
          status: task.status,
          model_code: task.model_code,
          fallback_used: task.fallback_used,
          audio_url: task.audio_url,
          audio_duration_ms: task.audio_duration_ms,
          created_at: task.created_at,
        });
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      set({ isGenerating: false });
    }
  },

  reset: () => set(INITIAL_STATE),
}));
