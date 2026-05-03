"use client";

const MODELS = [
  { value: "MiMo-V2.5-TTS", label: "MiMo-V2.5-TTS（主模型）" },
  { value: "MiMo-V2-TTS", label: "MiMo-V2-TTS（降级备用）" },
];

interface ModelSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export function ModelSelector({ value, onChange }: ModelSelectorProps) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
    >
      {MODELS.map((model) => (
        <option key={model.value} value={model.value}>
          {model.label}
        </option>
      ))}
    </select>
  );
}
