// ─── DownloadForm Component ───────────────────────────────────────────────────
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Search, Loader2, X, ClipboardPaste } from "lucide-react";
import type { TikTokVideoInfo } from "@/types/tiktok";
import { cn } from "@/lib/utils";
import { BatchDownload } from "./BatchDownload";

const schema = z.object({
  url: z
    .string()
    .min(1, "URL tidak boleh kosong")
    .url("Format URL tidak valid")
    .refine((v) => v.includes("tiktok.com"), {
      message: "URL harus dari tiktok.com",
    }),
});

type FormValues = z.infer<typeof schema>;

interface DownloadFormProps {
  mode: "single" | "batch";
  isLoading: boolean;
  onFetch: (url: string) => Promise<TikTokVideoInfo | null>;
}

export function DownloadForm({ mode, isLoading, onFetch }: DownloadFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const urlValue = watch("url");

  const onSubmit = async (data: FormValues) => {
    await onFetch(data.url);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setValue("url", text, { shouldValidate: true });
    } catch {
      // Clipboard access denied
    }
  };

  if (mode === "batch") {
    return <BatchDownload />;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="glass-card p-6">
      <div className="flex gap-3">
        {/* URL Input */}
        <div className="flex-1 relative">
          <input
            id="tiktok-url-input"
            {...register("url")}
            type="url"
            placeholder="https://www.tiktok.com/@username/video/..."
            className={cn(
              "input-brand pr-10",
              errors.url && "border-red-500/50 focus:border-red-500/70"
            )}
            autoComplete="off"
            spellCheck={false}
            autoFocus
          />

          {/* Clear or Paste button */}
          <button
            type="button"
            onClick={urlValue ? () => reset() : handlePaste}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-brand-400 transition-colors"
            title={urlValue ? "Clear" : "Paste from clipboard"}
          >
            {urlValue ? (
              <X className="w-4 h-4" />
            ) : (
              <ClipboardPaste className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Submit Button */}
        <button
          id="fetch-info-btn"
          type="submit"
          className="btn-brand shrink-0 min-w-[120px]"
          disabled={isLoading}
        >
          {isLoading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Loading...</>
          ) : (
            <><Search className="w-4 h-4" /> Cari Video</>
          )}
        </button>
      </div>

      {/* Error message */}
      {errors.url && (
        <p className="mt-2 text-xs text-red-400 flex items-center gap-1">
          <span>⚠</span> {errors.url.message}
        </p>
      )}

      <p className="mt-3 text-xs text-slate-600">
        Contoh: <span className="font-mono text-slate-500">https://www.tiktok.com/@user/video/1234567890</span>
      </p>
    </form>
  );
}
