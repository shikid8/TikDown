// ─── VideoPreview Component ───────────────────────────────────────────────────
"use client";

import Image from "next/image";
import { useState } from "react";
import {
  Download,
  Music,
  Play,
  Heart,
  MessageCircle,
  Share2,
  Eye,
  CheckCircle,
  Loader2,
  BadgeCheck,
} from "lucide-react";
import type { TikTokVideoInfo, VideoQuality, DownloadFormat } from "@/types/tiktok";
import { formatCount, formatDuration, formatFileSize } from "@/lib/utils";
import { QualitySelector } from "./QualitySelector";

interface VideoPreviewProps {
  video: TikTokVideoInfo;
  onDownload: (url: string, title: string, quality: VideoQuality | "audio", format: DownloadFormat) => Promise<void>;
}

export function VideoPreview({ video, onDownload }: VideoPreviewProps) {
  const [downloading, setDownloading] = useState<string | null>(null);

  const availableOptions = video.downloadOptions.filter(o => !o.hasWatermark || o.quality === 'audio');
  
  const defaultQuality = availableOptions.find(o => o.quality !== 'audio')?.quality || availableOptions[0]?.quality || "1080p";
  const [selectedQuality, setSelectedQuality] = useState<VideoQuality | "audio">(defaultQuality);

  const handleDownload = async () => {
    const opt = availableOptions.find(o => o.quality === selectedQuality);
    if (!opt) return;

    const format = opt.quality === "audio" ? "mp3" : "mp4";
    const key = `${opt.quality}-${format}`;
    setDownloading(key);
    try {
      const filenameBase = `${video.author.username}_${video.id}`;
      await onDownload(opt.url, filenameBase, opt.quality, format);
    } finally {
      setDownloading(null);
    }
  };

  const qualityOptions = availableOptions.map(o => ({
    label: o.quality === 'audio' ? 'Audio (MP3)' : `Video (${o.quality})`,
    value: o.quality
  }));

  const selectedOption = availableOptions.find(o => o.quality === selectedQuality);

  return (
    <div className="glass-card overflow-hidden animate-slide-up">
      <div className="flex flex-col md:flex-row gap-0">
        {/* ── Thumbnail ── */}
        <div className="relative md:w-64 h-52 md:h-auto shrink-0 bg-slate-900/50">
          {video.thumbnail ? (
            <Image
              src={video.thumbnail}
              alt={video.title}
              fill
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Play className="w-10 h-10 text-slate-700" />
            </div>
          )}

          {/* Duration badge */}
          {video.duration > 0 && (
            <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-0.5 rounded-md backdrop-blur-sm font-mono">
              {formatDuration(video.duration)}
            </div>
          )}
        </div>

        {/* ── Info ── */}
        <div className="flex-1 p-6 flex flex-col gap-4">
          {/* Author */}
          <div className="flex items-center gap-3">
            {video.author.avatar && (
              <Image
                src={video.author.avatar}
                alt={video.author.nickname}
                width={36}
                height={36}
                className="rounded-full ring-2 ring-brand-500/30"
                unoptimized
              />
            )}
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-white text-sm">
                  {video.author.nickname}
                </span>
                {video.author.verified && (
                  <BadgeCheck className="w-4 h-4 text-brand-400" />
                )}
              </div>
              <span className="text-xs text-slate-500">@{video.author.username}</span>
            </div>
          </div>

          {/* Title */}
          <p className="text-slate-300 text-sm leading-relaxed line-clamp-2">
            {video.title}
          </p>

          {/* Stats */}
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" /> {formatCount(video.stats.plays)}
            </span>
            <span className="flex items-center gap-1">
              <Heart className="w-3.5 h-3.5 text-rose-400" /> {formatCount(video.stats.likes)}
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle className="w-3.5 h-3.5" /> {formatCount(video.stats.comments)}
            </span>
            <span className="flex items-center gap-1">
              <Share2 className="w-3.5 h-3.5" /> {formatCount(video.stats.shares)}
            </span>
          </div>

          {/* Music */}
          {video.music && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Music className="w-3.5 h-3.5 text-brand-400 shrink-0" />
              <span className="truncate">
                {video.music.title} · {video.music.author}
              </span>
            </div>
          )}

          {/* Download Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 mt-auto pt-2">
            <div className="w-full sm:w-44 shrink-0">
              <QualitySelector
                value={selectedQuality}
                onChange={setSelectedQuality}
                options={qualityOptions}
                disabled={downloading !== null}
              />
            </div>

            <button
              id="download-selected"
              onClick={handleDownload}
              disabled={downloading !== null || !selectedOption}
              className="btn-brand flex-1"
            >
              {downloading !== null ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Downloading...</>
              ) : (
                <>
                  {selectedQuality === 'audio' ? <Music className="w-4 h-4" /> : <Download className="w-4 h-4" />}
                  <span>Download {selectedQuality === 'audio' ? 'Audio' : 'Video'}</span>
                </>
              )}
            </button>

            {/* Size info */}
            {selectedOption?.size && (
              <div className="badge-brand self-center ml-auto">
                <CheckCircle className="w-3 h-3" />
                {formatFileSize(selectedOption.size)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
