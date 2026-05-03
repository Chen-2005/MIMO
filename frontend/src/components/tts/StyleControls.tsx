"use client";

import { useState } from "react";
import { ChevronDown, Clapperboard } from "lucide-react";

const STYLE_PRESETS = [
  {
    label: "自然讲解",
    prompt: "自然、平稳、像真人讲解，停顿自然，不要播音腔，不要夸张。",
    speed: 0.9,
  },
  {
    label: "温和叙述",
    prompt: "语气柔和、自然交流、句尾收得干净，节奏舒缓，不要机械感。",
    speed: 0.85,
  },
  {
    label: "短视频旁白",
    prompt: "清晰、自然、有轻微节奏感，表达流畅，不要过度夸张。",
    speed: 0.95,
  },
];

const CHARACTER_HINTS = [
  "25岁知性女性，说话温和有条理",
  "40岁成熟男性，声音沉稳有力",
  "18岁活泼少女，语调轻快上扬",
  "资深播音员，吐字清晰标准",
];

const SCENE_HINTS = [
  "正在录制一档知识分享节目，面向年轻观众",
  "在安静的录音棚里为有声书配音",
  "为产品宣传片做旁白，需要专业感",
  "和朋友轻松聊天，氛围随意自然",
];

const DIRECTION_HINTS = [
  "语速平稳适中，句间留有自然停顿，情绪保持温和",
  "开头稍慢引人入胜，中段节奏加快，结尾放慢收束",
  "全程保持克制，不要夸张，像真人在耳边说话",
  "关键句子加重语气，其余保持轻松自然",
];

interface StyleControlsProps {
  stylePrompt: string;
  onStylePromptChange: (value: string) => void;
  speed: number;
  onSpeedChange: (value: number) => void;
  outputFormat: string;
  onOutputFormatChange: (value: string) => void;
}

export function StyleControls({
  stylePrompt,
  onStylePromptChange,
  speed,
  onSpeedChange,
  outputFormat,
  onOutputFormatChange,
}: StyleControlsProps) {
  const [showDirector, setShowDirector] = useState(false);
  const [director, setDirector] = useState({
    character: "",
    scene: "",
    direction: "",
  });

  const buildDirectorPrompt = () => {
    const parts: string[] = [];
    if (director.character) parts.push(`[角色] ${director.character}`);
    if (director.scene) parts.push(`[场景] ${director.scene}`);
    if (director.direction) parts.push(`[指令] ${director.direction}`);
    return parts.join("\n");
  };

  const applyDirector = () => {
    const prompt = buildDirectorPrompt();
    if (prompt) {
      onStylePromptChange(prompt);
      setShowDirector(false);
    }
  };

  const applyHint = (
    field: "character" | "scene" | "direction",
    value: string,
  ) => {
    setDirector((d) => ({ ...d, [field]: value }));
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-500">风格控制</label>

        <div className="mb-2 flex flex-wrap items-center gap-2">
          {STYLE_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                onStylePromptChange(preset.prompt);
                onSpeedChange(preset.speed);
              }}
              className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-600 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
            >
              {preset.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowDirector((current) => !current)}
            className="flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs text-amber-700 transition-colors hover:border-amber-400 hover:bg-amber-100"
          >
            <Clapperboard className="h-3 w-3" />
            导演模式
            <ChevronDown className={`h-3 w-3 transition-transform ${showDirector ? "rotate-180" : ""}`} />
          </button>
        </div>

        {showDirector && (
          <div className="mb-3 space-y-3 rounded-lg border border-amber-100 bg-amber-50 p-3">
            <p className="text-xs text-amber-700">
              导演模式通过结构化的角色、场景、指令三个维度精确控制语音表现。填写后会替代下方的风格提示词。
            </p>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">[角色]</label>
              <textarea
                value={director.character}
                onChange={(e) => setDirector((d) => ({ ...d, character: e.target.value }))}
                placeholder="身份、性格、说话习惯，例如：25岁知性女性，说话温和有条理"
                rows={2}
                className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
              />
              <div className="mt-1 flex flex-wrap gap-1">
                {CHARACTER_HINTS.map((hint) => (
                  <button
                    key={hint}
                    type="button"
                    onClick={() => applyHint("character", hint)}
                    className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-500 hover:border-amber-300 hover:text-amber-700"
                  >
                    {hint.length > 15 ? hint.slice(0, 15) + "..." : hint}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">[场景]</label>
              <textarea
                value={director.scene}
                onChange={(e) => setDirector((d) => ({ ...d, scene: e.target.value }))}
                placeholder="正在发生什么、面向谁、情绪状态，例如：正在录制知识分享节目"
                rows={2}
                className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
              />
              <div className="mt-1 flex flex-wrap gap-1">
                {SCENE_HINTS.map((hint) => (
                  <button
                    key={hint}
                    type="button"
                    onClick={() => applyHint("scene", hint)}
                    className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-500 hover:border-amber-300 hover:text-amber-700"
                  >
                    {hint.length > 15 ? hint.slice(0, 15) + "..." : hint}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">[指令]</label>
              <textarea
                value={director.direction}
                onChange={(e) => setDirector((d) => ({ ...d, direction: e.target.value }))}
                placeholder="语速、呼吸、停顿、重音、情绪弧线，例如：语速平稳适中，句间留有自然停顿"
                rows={2}
                className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
              />
              <div className="mt-1 flex flex-wrap gap-1">
                {DIRECTION_HINTS.map((hint) => (
                  <button
                    key={hint}
                    type="button"
                    onClick={() => applyHint("direction", hint)}
                    className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-500 hover:border-amber-300 hover:text-amber-700"
                  >
                    {hint.length > 15 ? hint.slice(0, 15) + "..." : hint}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={applyDirector}
              className="rounded-lg bg-amber-600 px-4 py-1.5 text-xs text-white hover:bg-amber-700"
            >
              应用导演模式
            </button>
          </div>
        )}

        <textarea
          value={stylePrompt}
          onChange={(event) => onStylePromptChange(event.target.value)}
          placeholder="例如：自然、平稳、像真人讲解，停顿自然，不要播音腔。"
          rows={3}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <p className="mt-1 text-xs text-gray-400">
          想要更自然，尽量写成一句完整要求，而不是只写"温柔""正式"这类单词。
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-gray-500">
            语速 {speed.toFixed(1)}x
          </label>
          <input
            type="range"
            min={0.5}
            max={2.0}
            step={0.1}
            value={speed}
            onChange={(event) => onSpeedChange(Number.parseFloat(event.target.value))}
            className="w-full accent-blue-600"
          />
          <div className="flex justify-between text-xs text-gray-400">
            <span>0.5x</span>
            <span>2.0x</span>
          </div>
        </div>
        <div className="sm:w-32">
          <label className="mb-1 block text-xs font-medium text-gray-500">输出格式</label>
          <select
            value={outputFormat}
            onChange={(event) => onOutputFormatChange(event.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="mp3">MP3</option>
            <option value="wav">WAV</option>
          </select>
        </div>
      </div>
    </div>
  );
}
