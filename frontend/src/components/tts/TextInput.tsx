"use client";

import { useRef, useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";

const TAG_GROUPS = [
  {
    label: "情绪",
    tags: ["开心", "悲伤", "愤怒", "惊讶", "兴奋", "委屈", "平静", "冷漠", "感动", "焦虑", "疲惫", "无奈"],
  },
  {
    label: "基调",
    tags: ["温柔", "冷酷", "活泼", "严肃", "慵懒", "俏皮", "低沉", "犀利"],
  },
  {
    label: "音色",
    tags: ["磁性", "醇厚", "清亮", "空灵", "甜美", "沙哑"],
  },
  {
    label: "方言",
    tags: ["东北话", "四川话", "河南话", "粤语"],
  },
  {
    label: "角色",
    tags: ["夹子音", "成熟女声", "正太音", "大叔音", "台湾腔"],
  },
];

interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
}

export function TextInput({ value, onChange, maxLength = 5000 }: TextInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showTags, setShowTags] = useState(false);

  const insertTag = (tag: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = value.slice(0, start);
    const after = value.slice(end);
    const newValue = `${before}(${tag})${after}`;
    onChange(newValue);

    requestAnimationFrame(() => {
      textarea.focus();
      const pos = start + tag.length + 2;
      textarea.setSelectionRange(pos, pos);
    });
  };

  return (
    <div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={maxLength}
        placeholder="请输入要转换成语音的文本..."
        className="w-full resize-none rounded-lg border border-gray-300 p-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        rows={6}
      />
      <div className="mt-2">
        <button
          type="button"
          onClick={() => setShowTags((current) => !current)}
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
        >
          <Sparkles className="h-3.5 w-3.5" />
          插入表现力标签
          <ChevronDown
            className={`h-3 w-3 transition-transform ${showTags ? "rotate-180" : ""}`}
          />
        </button>
        {showTags && (
          <div className="mt-2 space-y-2 rounded-lg border border-blue-100 bg-blue-50 p-3">
            <p className="text-xs leading-5 text-blue-700">
              在文本中插入标签可以控制语气和情绪，例如 <span className="font-medium">(开心)大家好</span>。每句话建议最多一个标签。
            </p>
            {TAG_GROUPS.map((group) => (
              <div key={group.label}>
                <span className="text-xs font-medium text-slate-500">{group.label}</span>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {group.tags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => insertTag(tag)}
                      className="rounded-full border border-blue-200 bg-white px-2.5 py-1 text-xs text-blue-700 transition-colors hover:border-blue-400 hover:bg-blue-100"
                    >
                      ({tag})
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div>
              <span className="text-xs font-medium text-slate-500">特殊</span>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => insertTag("唱歌")}
                  className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs text-amber-700 transition-colors hover:border-amber-400 hover:bg-amber-100"
                >
                  (唱歌)
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="mt-1 flex justify-between text-xs text-gray-400">
        <span>支持中英文内容，长文本会自动分段生成。</span>
        <span>
          {value.length} / {maxLength}
        </span>
      </div>
    </div>
  );
}
