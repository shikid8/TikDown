// ─── Download History Component ───────────────────────────────────────────────
"use client";

import Image from "next/image";
import { Download, Trash2, Music, Film, Clock } from "lucide-react";
import { useDownloadStore } from "@/store/downloadStore";
import { formatRelativeTime, formatFileSize } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export function DownloadHistory() {
  const { history, clearHistory } = useDownloadStore();

  if (history.length === 0) {
    return (
      <div className="text-center py-16 text-slate-600">
        <Clock className="w-12 h-12 mx-auto mb-4 opacity-30" />
        <p className="text-sm">Belum ada riwayat download</p>
        <p className="text-xs mt-1 text-slate-700">
          Download video pertamamu untuk melihat riwayat di sini
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">
          {history.length} video diunduh
        </p>
        <button
          onClick={clearHistory}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-400 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Hapus Semua
        </button>
      </div>

      {/* List */}
      <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1 custom-scrollbar">
        <AnimatePresence>
          {history.map((item, idx) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
              className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800/60 hover:border-slate-700/60 transition-colors group"
            >
              {/* Thumbnail */}
              <div className="relative w-14 h-10 rounded-lg overflow-hidden shrink-0 bg-slate-800">
                {item.thumbnail ? (
                  <Image
                    src={item.thumbnail}
                    alt={item.videoTitle}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    {item.format === "mp3" ? (
                      <Music className="w-4 h-4 text-slate-600" />
                    ) : (
                      <Film className="w-4 h-4 text-slate-600" />
                    )}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white font-medium truncate leading-tight">
                  {item.videoTitle}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-slate-500">
                    {formatRelativeTime(item.completedAt)}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono uppercase">
                    {item.format}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {item.quality === "audio" ? "Audio" : item.quality}
                  </span>
                  {item.fileSize && (
                    <span className="text-[10px] text-slate-600">
                      {formatFileSize(item.fileSize)}
                    </span>
                  )}
                </div>
              </div>

              {/* Re-download button */}
              <a
                href={`/api/download?url=${encodeURIComponent(item.url)}&title=${encodeURIComponent(item.videoTitle)}&format=${item.format}`}
                download
                className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-brand-500/20 text-slate-500 hover:text-brand-400"
                title="Download ulang"
              >
                <Download className="w-3.5 h-3.5" />
              </a>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

