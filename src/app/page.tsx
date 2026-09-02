// ─── Main Page ────────────────────────────────────────────────────────────────
"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Music2, Layers } from "lucide-react";
import { DownloadForm } from "@/components/DownloadForm";
import { VideoPreview } from "@/components/VideoPreview";
import { useDownload } from "@/hooks/useDownload";

export default function HomePage() {
  const [mode, setMode] = useState<"single" | "batch">("single");
  const { currentVideo, isFetching, fetchVideoInfo, downloadVideo } = useDownload();

  return (
    <main className="min-h-screen flex flex-col">
      {/* ── Header ── */}
      <header className="border-b border-white/5 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-brand-sm">
              <Music2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-white text-sm leading-none">TikTok Downloader</h1>
              <p className="text-xs text-slate-500 mt-0.5">Premium HD Downloads</p>
            </div>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="flex-1 max-w-5xl mx-auto w-full px-4 py-12 flex flex-col gap-8">
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center space-y-3"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-white text-glow">
            Download Video TikTok
          </h2>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            Unduh video HD tanpa watermark · Gunakan session cookies TikTok
            untuk akses konten eksklusif
          </p>
        </motion.div>

        {/* Mode Toggle */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className="flex justify-center"
        >
          <div className="glass-card p-1 flex gap-1">
            <button
              id="mode-single"
              onClick={() => setMode("single")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                mode === "single"
                  ? "bg-brand-500 text-white shadow-brand-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Music2 className="w-4 h-4" />
              Single Video
            </button>
            <button
              id="mode-batch"
              onClick={() => setMode("batch")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                mode === "batch"
                  ? "bg-brand-500 text-white shadow-brand-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Layers className="w-4 h-4" />
              Batch Download
            </button>
          </div>
        </motion.div>

        {/* Download Form */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.5 }}
        >
          <DownloadForm
            mode={mode}
            isLoading={isFetching}
            onFetch={fetchVideoInfo}
          />
        </motion.div>

        {/* Skeleton Loading */}
        <AnimatePresence>
          {isFetching && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="glass-card p-4 sm:p-6 w-full mx-auto animate-pulse"
            >
              <div className="flex flex-col sm:flex-row gap-6">
                <div className="w-full sm:w-[220px] h-[360px] sm:h-[390px] rounded-xl bg-slate-800/50 shimmer shrink-0" />
                <div className="flex-1 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-slate-800/50 shimmer shrink-0" />
                    <div className="space-y-2 flex-1">
                      <div className="h-4 bg-slate-800/50 rounded w-1/3 shimmer" />
                      <div className="h-3 bg-slate-800/50 rounded w-1/4 shimmer" />
                    </div>
                  </div>
                  <div className="space-y-2 pt-2">
                    <div className="h-3 bg-slate-800/50 rounded w-full shimmer" />
                    <div className="h-3 bg-slate-800/50 rounded w-5/6 shimmer" />
                    <div className="h-3 bg-slate-800/50 rounded w-4/6 shimmer" />
                  </div>
                  <div className="flex gap-4 pt-4">
                    <div className="h-8 bg-slate-800/50 rounded w-16 shimmer" />
                    <div className="h-8 bg-slate-800/50 rounded w-16 shimmer" />
                    <div className="h-8 bg-slate-800/50 rounded w-16 shimmer" />
                  </div>
                  <div className="pt-6 space-y-3 mt-auto">
                    <div className="h-10 bg-slate-800/50 rounded-xl w-full shimmer" />
                    <div className="h-12 bg-slate-800/50 rounded-xl w-full shimmer" />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Video Preview */}
        <AnimatePresence>
          {currentVideo && !isFetching && (
            <motion.div
              key={currentVideo.id}
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 200, damping: 22 }}
            >
              <VideoPreview video={currentVideo} onDownload={downloadVideo} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty State */}
        {!currentVideo && !isFetching && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-center py-16 text-slate-600"
          >
            <Music2 className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-sm">Masukkan URL TikTok di atas untuk memulai</p>
          </motion.div>
        )}
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5 py-6 text-center text-sm text-slate-600">
        <p>Gunakan hanya untuk keperluan pribadi · Hormati hak cipta kreator</p>
      </footer>
    </main>
  );
}
