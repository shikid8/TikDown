"use client";

import { useState, useEffect } from "react";
import { Loader2, Search, CheckCircle, XCircle, Clock, AlertCircle, ListPlus } from "lucide-react";
import { QualitySelector } from "./QualitySelector";
import type { VideoQuality } from "@/types/tiktok";
import { cn, formatFileSize } from "@/lib/utils";
import { toast } from "sonner";

export type BatchStatus = "idle" | "pending" | "processing" | "success" | "error";

export interface BatchItem {
  id: string;
  url: string;
  status: BatchStatus;
  message?: string;
  progress?: number;
  data?: {
    title: string;
    size?: number;
    downloadUrl?: string;
    format?: string;
  };
  downloadTriggered?: boolean;
}

export function BatchDownload() {
  const [urlsText, setUrlsText] = useState("");
  const [quality, setQuality] = useState<VideoQuality | "audio">("1080p");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [items, setItems] = useState<BatchItem[]>([]);
  const [taskId, setTaskId] = useState<string | null>(null);

  const startBatch = async () => {
    const urls = urlsText.split("\n").map(u => u.trim()).filter(Boolean);
    if (urls.length === 0) return;

    const initialItems = urls.map((url, i) => ({
      id: `${i}-${Date.now()}`,
      url,
      status: "pending" as BatchStatus,
    }));
    
    setItems(initialItems);
    setIsProcessing(true);

    try {
      const res = await fetch("/api/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls, quality })
      });
      
      if (!res.ok) throw new Error("Failed to start batch");
      
      const data = await res.json();
      if (data.taskId) {
        setTaskId(data.taskId);
        toast.success("Tugas batch berhasil dimulai");
      }
    } catch (error: any) {
      console.error(error);
      setIsProcessing(false);
      toast.error("Gagal memulai tugas batch");
      setItems(items => items.map(item => ({...item, status: "error", message: "Gagal memulai tugas"})));
    }
  };

  const extractUrls = async () => {
    const urls = urlsText.split("\n").map(u => u.trim()).filter(Boolean);
    if (urls.length !== 1) return;
    
    setIsExtracting(true);
    try {
      const res = await fetch("/api/extract-urls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urls[0] })
      });
      
      const data = await res.json();
      if (res.ok && data.success && data.urls) {
        setUrlsText(data.urls.join("\n"));
        toast.success(`Berhasil mengekstrak ${data.urls.length} video!`);
      } else {
        toast.error(data.error || "Gagal mengekstrak URL");
      }
    } catch (e) {
      console.error(e);
      toast.error("Terjadi kesalahan jaringan saat mengekstrak.");
    } finally {
      setIsExtracting(false);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (taskId && isProcessing) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/batch?taskId=${taskId}`);
          if (!res.ok) return;
          const data = await res.json();
          
          if (data.items) {
            setItems(prevItems => {
              const newItems = [...data.items];
              // Persist downloadTriggered state from prevItems
              return newItems.map(newItem => {
                const prev = prevItems.find(p => p.id === newItem.id);
                if (prev && prev.downloadTriggered) {
                  newItem.downloadTriggered = true;
                }
                return newItem;
              });
            });
          }
          if (data.isComplete) {
            setIsProcessing(false);
            setTaskId(null);
            clearInterval(interval);
          }
        } catch (e) {
          console.error("Polling error", e);
        }
      }, 2000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [taskId, isProcessing]);

  // Effect to trigger actual file downloads when items succeed
  useEffect(() => {
    items.forEach((item) => {
      if (item.status === "success" && item.data?.downloadUrl && !item.downloadTriggered) {
        // Mark as triggered to prevent multiple downloads
        setItems(prev => prev.map(p => p.id === item.id ? { ...p, downloadTriggered: true } : p));
        
        // Trigger download via API endpoint (which streams it with correct Content-Disposition)
        const format = item.data.format || "mp4";
        const title = encodeURIComponent(item.data.title || "tiktok_video");
        const url = encodeURIComponent(item.data.downloadUrl);
        const downloadApiUrl = `/api/download?url=${url}&title=${title}&format=${format}`;
        
        // Create an invisible iframe to trigger the download without opening a new tab
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = downloadApiUrl;
        document.body.appendChild(iframe);
        
        // Cleanup iframe after a delay to allow download to start
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 10000);
      }
    });
  }, [items]);

  const urlsCount = urlsText.split("\n").map(u => u.trim()).filter(Boolean).length;
  const isCollectionUrl = urlsCount === 1 && (urlsText.includes("/collection/") || urlsText.includes("/playlist/") || (urlsText.includes("@") && !urlsText.includes("/video/")));

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (isProcessing) return;
    
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.txt')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result;
        if (typeof text === 'string') {
          // Append to existing, or overwrite if empty
          setUrlsText(prev => prev ? `${prev}\n${text}` : text);
          toast.success("File .txt berhasil dimuat!");
        }
      };
      reader.readAsText(file);
    } else if (file) {
      toast.error("Hanya file .txt yang didukung");
    } else {
      const text = e.dataTransfer.getData("text/plain");
      if (text) {
        setUrlsText(prev => prev ? `${prev}\n${text}` : text);
      }
    }
  };

  return (
    <div className="glass-card p-6 space-y-4 animate-slide-up">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-white text-sm">Batch Download</h3>
        <span className="badge-brand">{urlsCount} URL</span>
      </div>
      
      <div 
        className="relative"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <textarea
          id="batch-url-input"
          className={cn(
            "input-brand min-h-[120px] resize-none transition-all duration-300",
            isDragging ? "border-brand-400 bg-brand-500/10 ring-2 ring-brand-500/30" : ""
          )}
          placeholder={"https://www.tiktok.com/@user/video/123\nhttps://www.tiktok.com/@user/video/456\n...\n(Atau drag & drop file .txt ke sini)"}
          value={urlsText}
          onChange={(e) => setUrlsText(e.target.value)}
          disabled={isProcessing}
        />
        {isDragging && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none rounded-xl bg-brand-900/20 backdrop-blur-sm border-2 border-dashed border-brand-400">
            <p className="text-brand-300 font-medium">Lepaskan file .txt di sini</p>
          </div>
        )}
      </div>
      
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-2 w-full sm:w-1/2">
          <span className="text-sm text-slate-400">Kualitas:</span>
          <QualitySelector
            value={quality}
            onChange={setQuality}
            disabled={isProcessing}
            options={[
              { label: "High (1080p)", value: "1080p" },
              { label: "Standard (720p)", value: "720p" },
              { label: "Audio Only (MP3)", value: "audio" },
            ]}
          />
        </div>
        
        <p className="text-xs text-slate-500 text-right w-full sm:w-auto">
          Satu URL per baris
        </p>
      </div>

      {isCollectionUrl ? (
        <button
          className="btn-ghost w-full border border-brand-500/30 text-brand-400 hover:bg-brand-500/10 mt-2"
          disabled={isExtracting}
          onClick={extractUrls}
        >
          {isExtracting ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Sedang Mengekstrak Koleksi (Mohon Tunggu)...</>
          ) : (
            <><ListPlus className="w-4 h-4" /> Ekstrak Video dari Koleksi/Playlist</>
          )}
        </button>
      ) : (
        <button
          id="batch-download-btn"
          className="btn-brand w-full mt-2"
          disabled={isProcessing || urlsCount === 0 || isExtracting}
          onClick={startBatch}
        >
          {isProcessing ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Memproses...</>
          ) : (
            <><Search className="w-4 h-4" /> Proses Semua {urlsCount > 0 ? `(${urlsCount}) ` : ""}URL</>
          )}
        </button>
      )}

      {/* Progress Items */}
      {items.length > 0 && (
        <div className="mt-6 space-y-3 pt-4 border-t border-slate-800/50">
          <h4 className="text-sm font-medium text-slate-300">Status Download</h4>
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
            {items.map((item) => (
              <div key={item.id} className="flex flex-col gap-2 p-3 rounded-lg bg-slate-900/50 border border-slate-800">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-mono text-slate-400 truncate flex-1">
                    {item.data?.title ? item.data.title : item.url}
                  </div>
                  <div className="shrink-0 flex items-center gap-1.5 text-xs">
                    {item.status === "pending" && <><Clock className="w-3.5 h-3.5 text-slate-500"/> <span className="text-slate-500">Menunggu</span></>}
                    {item.status === "processing" && <><Loader2 className="w-3.5 h-3.5 text-brand-400 animate-spin"/> <span className="text-brand-400">Memproses</span></>}
                    {item.status === "success" && <><CheckCircle className="w-3.5 h-3.5 text-emerald-400"/> <span className="text-emerald-400">Selesai</span></>}
                    {item.status === "error" && <><XCircle className="w-3.5 h-3.5 text-red-400"/> <span className="text-red-400">Gagal</span></>}
                  </div>
                </div>
                
                {item.status === "processing" && item.progress !== undefined && (
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-brand-500 h-full transition-all duration-300 ease-out" 
                      style={{ width: `${item.progress}%` }} 
                    />
                  </div>
                )}
                
                {(item.message || item.data?.size) && (
                  <div className="flex justify-between items-center text-[10px] text-slate-500">
                    <span className={item.status === "error" ? "text-red-400/80 flex items-center gap-1" : ""}>
                      {item.status === "error" && <AlertCircle className="w-3 h-3"/>}
                      {item.message || ""}
                    </span>
                    {item.data?.size && <span>{formatFileSize(item.data.size)}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
