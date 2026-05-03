"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { VoiceDesignTab } from "@/components/voice/VoiceDesignTab";
import { VoiceListTab } from "@/components/voice/VoiceListTab";

const TABS = [
  { key: "all", label: "全部音色" },
  { key: "design", label: "音色设计" },
];

export default function VoicesPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("all");

  const handleUseForClone = (audioUrl: string) => {
    router.push(`/workspace?cloneAudioUrl=${encodeURIComponent(audioUrl)}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">音色中心</h1>
        <p className="text-gray-500">这里专门用于管理预置音色、设计音色和克隆音色。</p>
      </div>

      <div className="flex gap-1 rounded-lg border bg-white p-1 shadow-sm">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-blue-600 text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "all" && <VoiceListTab />}
      {activeTab === "design" && <VoiceDesignTab onUseForClone={handleUseForClone} />}
    </div>
  );
}
