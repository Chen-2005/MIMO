"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Loader2, Plus, Wand2 } from "lucide-react";

import type { VoiceProfileItem } from "@/types";
import { createVoiceDesign, deleteVoiceProfile, listVoiceProfiles } from "@/services/voice";

import { VoiceCard } from "./VoiceCard";
import { VoiceDetailPanel } from "./VoiceDetailPanel";

const DESCRIPTION_TEMPLATES = [
  {
    label: "温柔知性女声",
    description: "30岁左右的女性声音，气息柔和，共鸣位置偏头腔，咬字清晰，音色温暖醇厚。语速平稳偏慢，情绪基调放松柔和，适合知识讲解和有声书。",
  },
  {
    label: "活力少年男声",
    description: "20岁左右的男性声音，气息充沛，口腔共鸣为主，咬字利落，音色明亮清脆。语速偏快有节奏感，情绪基调阳光积极，适合短视频和游戏解说。",
  },
  {
    label: "沉稳播报男声",
    description: "40岁左右的男性声音，气息稳定，胸腔共鸣，咬字标准，音色低沉有磁性。语速平稳，情绪基调克制专业，适合新闻播报和纪录片旁白。",
  },
  {
    label: "甜美少女",
    description: "18岁左右的女性声音，气息轻盈，头腔共鸣明显，咬字软糯，音色甜美空灵。语速稍快，情绪基调活泼俏皮，适合动漫配音和轻松内容。",
  },
];

const GENDER_OPTIONS = [
  { label: "女", value: "女性" },
  { label: "男", value: "男性" },
];

const AGE_OPTIONS = [
  { label: "少女 (16-22)", value: "18岁左右" },
  { label: "青年 (22-30)", value: "25岁左右" },
  { label: "中年 (30-45)", value: "35岁左右" },
  { label: "成熟 (45+)", value: "50岁左右" },
];

const TEXTURE_OPTIONS = [
  "气息柔和，头腔共鸣为主",
  "气息充沛，口腔共鸣为主",
  "气息稳定，胸腔共鸣",
  "气息轻盈，鼻腔共鸣明显",
];

const RHYTHM_OPTIONS = [
  "语速平稳",
  "语速偏快有节奏感",
  "语速偏慢",
  "语速变化丰富",
];

const EMOTION_OPTIONS = [
  "情绪基调放松柔和",
  "情绪基调阳光积极",
  "情绪基调克制专业",
  "情绪基调活泼俏皮",
  "情绪基调沉稳内敛",
];

interface VoiceDesignTabProps {
  onUseForClone?: (audioUrl: string) => void;
}

export function VoiceDesignTab({ onUseForClone }: VoiceDesignTabProps) {
  const [profiles, setProfiles] = useState<VoiceProfileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const [submitting, setSubmitting] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);

  // Builder state
  const [builder, setBuilder] = useState({
    gender: "",
    age: "",
    texture: "",
    rhythm: "",
    emotion: "",
    extra: "",
  });

  useEffect(() => {
    let cancelled = false;

    async function fetchProfiles() {
      setLoading(true);
      try {
        const data = await listVoiceProfiles("designed");
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
      const data = await listVoiceProfiles("designed");
      setProfiles(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const buildDescription = () => {
    const parts: string[] = [];
    if (builder.gender && builder.age) {
      parts.push(`${builder.age}的${builder.gender}声音`);
    }
    if (builder.texture) parts.push(builder.texture);
    if (builder.rhythm) parts.push(builder.rhythm);
    if (builder.emotion) parts.push(builder.emotion);
    if (builder.extra) parts.push(builder.extra);
    return parts.join("，") + "。";
  };

  const applyBuilder = () => {
    const desc = buildDescription();
    if (desc.length > 1) {
      setForm((current) => ({ ...current, description: desc }));
      setShowBuilder(false);
    }
  };

  const applyTemplate = (template: (typeof DESCRIPTION_TEMPLATES)[number]) => {
    setForm((current) => ({
      ...current,
      description: template.description,
    }));
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.description.trim()) return;

    setSubmitting(true);
    try {
      await createVoiceDesign({
        name: form.name,
        model_code: "MiMo-V2.5-TTS-VoiceDesign",
        description: form.description,
      });
      setForm({ name: "", description: "" });
      setShowForm(false);
      await refreshProfiles();
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">已设计音色</h3>
        <button
          onClick={() => setShowForm((current) => !current)}
          className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700"
        >
          <Plus className="h-3.5 w-3.5" />
          新建设计音色
        </button>
      </div>

      {showForm && (
        <div className="space-y-4 rounded-lg border bg-white p-4 shadow-sm">
          <div>
            <label className="mb-1 block text-xs text-gray-500">音色名称</label>
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="例如：温柔女声"
              className="w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs text-gray-500">音色描述</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowBuilder((current) => !current)}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                >
                  <Wand2 className="h-3 w-3" />
                  描述生成器
                  <ChevronDown className={`h-3 w-3 transition-transform ${showBuilder ? "rotate-180" : ""}`} />
                </button>
              </div>
            </div>

            {showBuilder && (
              <div className="mb-3 space-y-3 rounded-lg border border-blue-100 bg-blue-50 p-3">
                <p className="text-xs text-blue-700">
                  选择特征后自动生成描述。好的描述应包含：身份（年龄+性别）、声音质感、语速节奏、情绪基调。
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">性别</label>
                    <div className="flex gap-1.5">
                      {GENDER_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setBuilder((b) => ({ ...b, gender: opt.value }))}
                          className={`flex-1 rounded-lg border px-2 py-1.5 text-xs ${
                            builder.gender === opt.value
                              ? "border-blue-500 bg-blue-100 text-blue-700"
                              : "border-slate-200 bg-white text-slate-600 hover:border-blue-300"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">年龄段</label>
                    <select
                      value={builder.age}
                      onChange={(e) => setBuilder((b) => ({ ...b, age: e.target.value }))}
                      className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                    >
                      <option value="">请选择</option>
                      {AGE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">语速</label>
                    <select
                      value={builder.rhythm}
                      onChange={(e) => setBuilder((b) => ({ ...b, rhythm: e.target.value }))}
                      className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                    >
                      <option value="">请选择</option>
                      {RHYTHM_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">声音质感</label>
                  <div className="flex flex-wrap gap-1.5">
                    {TEXTURE_OPTIONS.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setBuilder((b) => ({ ...b, texture: opt }))}
                        className={`rounded-full border px-2.5 py-1 text-xs ${
                          builder.texture === opt
                            ? "border-blue-500 bg-blue-100 text-blue-700"
                            : "border-slate-200 bg-white text-slate-600 hover:border-blue-300"
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">情绪基调</label>
                  <div className="flex flex-wrap gap-1.5">
                    {EMOTION_OPTIONS.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setBuilder((b) => ({ ...b, emotion: opt }))}
                        className={`rounded-full border px-2.5 py-1 text-xs ${
                          builder.emotion === opt
                            ? "border-blue-500 bg-blue-100 text-blue-700"
                            : "border-slate-200 bg-white text-slate-600 hover:border-blue-300"
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    补充特征（选填）
                  </label>
                  <input
                    value={builder.extra}
                    onChange={(e) => setBuilder((b) => ({ ...b, extra: e.target.value }))}
                    placeholder="例如：偶尔有轻微的气声，尾音微微上扬"
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                  />
                </div>
                <button
                  type="button"
                  onClick={applyBuilder}
                  className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs text-white hover:bg-blue-700"
                >
                  生成描述
                </button>
              </div>
            )}

            <div className="mb-2">
              <p className="text-xs text-gray-400">快速模板</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {DESCRIPTION_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.label}
                    type="button"
                    onClick={() => applyTemplate(tpl)}
                    className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600 hover:border-blue-300 hover:bg-blue-50"
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
              placeholder="描述音色特征，例如：30岁左右的女性声音，气息柔和，语速平稳，情绪基调放松柔和，适合知识讲解。"
              rows={4}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
            <p className="mt-1 text-xs text-gray-400">
              好的描述 = 年龄性别 + 声音质感 + 语速节奏 + 情绪基调。1-2 句话，不要写场景或动作。
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => void handleSubmit()}
              disabled={submitting || !form.name.trim() || !form.description.trim()}
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? "提交中..." : "提交设计"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="rounded-lg border px-4 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : profiles.length === 0 ? (
        <div className="py-12 text-center text-gray-400">暂无设计音色，点击上方按钮创建。</div>
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
                  onClose={() => setExpandedId(null)}
                  onUpdated={() => void refreshProfiles()}
                  onUseForClone={onUseForClone}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
