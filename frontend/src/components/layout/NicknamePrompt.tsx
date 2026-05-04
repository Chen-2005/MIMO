"use client";

import { useState, useEffect } from "react";
import { getNickname, setNickname } from "@/services/userIdentity";

export function NicknamePrompt() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");

  useEffect(() => {
    if (!getNickname()) setOpen(true);
  }, []);

  const handleSubmit = () => {
    const name = value.trim();
    if (!name) return;
    setNickname(name);
    setOpen(false);
    window.location.reload();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
        <h2 className="text-lg font-semibold mb-2">欢迎使用 MiMo TTS</h2>
        <p className="text-sm text-gray-500 mb-4">
          请输入你的昵称，用于区分你的数据。
        </p>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="例如：张三"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          autoFocus
        />
        <button
          onClick={handleSubmit}
          disabled={!value.trim()}
          className="mt-4 w-full bg-emerald-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          确认
        </button>
      </div>
    </div>
  );
}
