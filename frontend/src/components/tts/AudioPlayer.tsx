"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Pause, Download, Loader2 } from "lucide-react";
import { formatDuration } from "@/lib/utils";

interface AudioPlayerProps {
  src: string;
  durationMs?: number;
  downloadUrl?: string;
}

export function AudioPlayer({ src, durationMs, downloadUrl }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [downloadingFormat, setDownloadingFormat] = useState<"wav" | "mp3" | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => setCurrentTime(audio.currentTime);
    const onLoaded = () => setTotalDuration(audio.duration);
    const onEnded = () => setPlaying(false);

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("ended", onEnded);
    };
  }, [src]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      audio.play();
    }
    setPlaying(!playing);
  };

  const progress = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  const handleDownload = useCallback(async (format: "wav" | "mp3") => {
    if (!downloadUrl || downloadingFormat) return;
    setDownloadingFormat(format);
    try {
      const joiner = downloadUrl.includes("?") ? "&" : "?";
      const resp = await fetch(`${downloadUrl}${joiner}format=${format}`);
      if (!resp.ok) throw new Error("下载失败");
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = resp.headers.get("content-disposition");
      const match = disposition?.match(/filename=(.+)/);
      a.download = match ? match[1] : `audio.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    } finally {
      setDownloadingFormat(null);
    }
  }, [downloadUrl, downloadingFormat]);

  return (
    <div className="space-y-3">
      <audio ref={audioRef} src={src} preload="metadata" />

      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
        </button>
        <div className="flex-1">
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full bg-blue-600 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-xs text-gray-400">
            <span>{formatDuration(currentTime * 1000)}</span>
            <span>{durationMs ? formatDuration(durationMs) : formatDuration(totalDuration * 1000)}</span>
          </div>
        </div>
        {downloadUrl && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => void handleDownload("wav")}
              disabled={Boolean(downloadingFormat)}
              className="flex h-8 items-center justify-center gap-1 rounded-lg border border-gray-300 px-2 text-xs text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {downloadingFormat === "wav" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              WAV
            </button>
            <button
              onClick={() => void handleDownload("mp3")}
              disabled={Boolean(downloadingFormat)}
              className="flex h-8 items-center justify-center gap-1 rounded-lg border border-gray-300 px-2 text-xs text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {downloadingFormat === "mp3" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              MP3
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
