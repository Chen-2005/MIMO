"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, RotateCcw, X } from "lucide-react";

import { TaskStatusBadge } from "@/components/common/TaskStatusBadge";
import { AudioPlayer } from "@/components/tts/AudioPlayer";
import { formatDuration } from "@/lib/utils";
import { cancelTask, getTask, listTasks, retryTask, getTaskAudioUrl } from "@/services/tts";
import { resolveBaseUrl } from "@/services/api";
import type { TaskDetail, TaskListItem } from "@/types";

const STATUS_OPTIONS = [
  { value: "", label: "全部状态" },
  { value: "queued", label: "排队中" },
  { value: "running", label: "生成中" },
  { value: "succeeded", label: "已完成" },
  { value: "failed", label: "失败" },
  { value: "canceled", label: "已取消" },
];

const MODEL_OPTIONS = [
  { value: "", label: "全部模型" },
  { value: "MiMo-V2.5-TTS", label: "MiMo-V2.5-TTS" },
  { value: "MiMo-V2-TTS", label: "MiMo-V2-TTS" },
];

const PAGE_SIZE = 10;

export default function HistoryPage() {
  const [tasks, setTasks] = useState<TaskListItem[]>([]);
  const [taskDetails, setTaskDetails] = useState<Record<number, TaskDetail>>({});
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [modelFilter, setModelFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchTasks() {
      setLoading(true);
      try {
        const result = await listTasks({
          page,
          page_size: PAGE_SIZE,
          status: statusFilter || undefined,
          model_code: modelFilter || undefined,
        });

        if (cancelled) return;
        setTasks(result.list);
        setTotal(result.total);
      } catch {
        if (!cancelled) {
          setTasks([]);
          setTotal(0);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void fetchTasks();

    return () => {
      cancelled = true;
    };
  }, [page, statusFilter, modelFilter]);

  useEffect(() => {
    if (expandedId === null || taskDetails[expandedId]) return;

    let cancelled = false;

    async function fetchTaskDetail() {
      try {
        const detail = await getTask(expandedId!);
        if (!cancelled) {
          setTaskDetails((current) => ({ ...current, [expandedId!]: detail }));
        }
      } catch {
        // ignore
      }
    }

    void fetchTaskDetail();

    return () => {
      cancelled = true;
    };
  }, [expandedId, taskDetails]);

  const refreshTasks = async () => {
    setLoading(true);
    try {
      const result = await listTasks({
        page,
        page_size: PAGE_SIZE,
        status: statusFilter || undefined,
        model_code: modelFilter || undefined,
      });
      setTasks(result.list);
      setTotal(result.total);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async (taskId: number) => {
    try {
      await retryTask(taskId);
      await refreshTasks();
    } catch {
      // ignore
    }
  };

  const handleCancel = async (taskId: number) => {
    try {
      await cancelTask(taskId);
      await refreshTasks();
    } catch {
      // ignore
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const formatDate = (value?: string) => {
    if (!value) return "-";
    return new Date(value).toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">任务历史</h1>
        <p className="text-gray-500">查看所有 TTS 任务的状态和生成结果。</p>
      </div>

      <div className="rounded-lg border bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b p-4">
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={modelFilter}
            onChange={(event) => {
              setModelFilter(event.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            {MODEL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="flex-1" />
          <span className="text-sm text-gray-400">共 {total} 条</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-xs font-medium text-gray-500">
                <th className="px-4 py-3">任务号</th>
                <th className="px-4 py-3">状态</th>
                <th className="px-4 py-3">模型</th>
                <th className="px-4 py-3">时长</th>
                <th className="px-4 py-3">创建时间</th>
                <th className="px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                  </td>
                </tr>
              ) : tasks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                    暂无任务记录
                  </td>
                </tr>
              ) : (
                tasks.flatMap((task) => {
                  const detail = taskDetails[task.task_id];
                  return [
                    <tr
                      key={task.task_id}
                      className="cursor-pointer border-b hover:bg-gray-50"
                      onClick={() =>
                        setExpandedId((current) => (current === task.task_id ? null : task.task_id))
                      }
                    >
                      <td className="px-4 py-3 font-mono text-xs">{task.task_no}</td>
                      <td className="px-4 py-3">
                        <TaskStatusBadge status={task.status} />
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {task.model_code}
                        {task.fallback_used && (
                          <span className="ml-1 text-xs text-orange-500">降级</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {task.audio_duration_ms ? formatDuration(task.audio_duration_ms) : "-"}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{formatDate(task.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {task.status === "failed" && (
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleRetry(task.task_id);
                              }}
                              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-blue-600"
                              title="重试"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </button>
                          )}
                          {(task.status === "queued" || task.status === "running") && (
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleCancel(task.task_id);
                              }}
                              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600"
                              title="取消"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>,
                    expandedId === task.task_id ? (
                      <tr key={`${task.task_id}-detail`}>
                        <td colSpan={6} className="bg-gray-50 px-4 py-3">
                          {detail?.status === "succeeded" && detail.audio_url ? (
                            <AudioPlayer
                              src={`${resolveBaseUrl()}${detail.audio_url}`}
                              durationMs={detail.audio_duration_ms}
                              downloadUrl={getTaskAudioUrl(task.task_id)}
                            />
                          ) : (
                            <span className="text-sm text-gray-400">
                              {detail
                                ? detail.status === "failed"
                                  ? "任务失败，请点击重试。"
                                  : "任务尚未完成。"
                                : "正在加载任务详情..."}
                            </span>
                          )}
                        </td>
                      </tr>
                    ) : null,
                  ];
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <button
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
              上一页
            </button>
            <span className="text-sm text-gray-500">
              第 {page} / {totalPages} 页
            </span>
            <button
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page >= totalPages}
              className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
            >
              下一页
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
