// ─── CookieManager Component ──────────────────────────────────────────────────
"use client";

import { useState } from "react";
import { Cookie, CheckCircle, XCircle, Loader2, X, Trash2, ShieldCheck } from "lucide-react";
import { useCookies } from "@/hooks/useCookies";
import type { CookieFormat } from "@/types/cookie";
import { cn, formatRelativeTime } from "@/lib/utils";

const FORMAT_TABS: { label: string; value: CookieFormat; hint: string }[] = [
  {
    label: "Netscape",
    value: "netscape",
    hint: "Format dari EditThisCookie / Cookie-Editor browser extension",
  },
  {
    label: "JSON",
    value: "json",
    hint: 'Array JSON: [{"name":"sessionid","value":"...","domain":".tiktok.com",...}]',
  },
  {
    label: "Header",
    value: "header",
    hint: 'String header: "sessionid=xxx; tt_chain_token=yyy; ..."',
  },
];

const PLACEHOLDER: Record<CookieFormat, string> = {
  netscape: `# Netscape HTTP Cookie File
.tiktok.com\tTRUE\t/\tTRUE\t0\tsessionid\tyour-session-id-here
.tiktok.com\tTRUE\t/\tTRUE\t0\ttt_chain_token\tyour-token-here`,
  json: `[
  {"name":"sessionid","value":"your-session-id","domain":".tiktok.com","path":"/"},
  {"name":"tt_chain_token","value":"your-token","domain":".tiktok.com","path":"/"}
]`,
  header: `sessionid=your-session-id; tt_chain_token=your-token; msToken=your-ms-token`,
};

export function CookieManager() {
  const [isOpen, setIsOpen] = useState(false);
  const [format, setFormat] = useState<CookieFormat>("netscape");
  const [rawInput, setRawInput] = useState("");

  const { hasSession, cookieCount, savedAt, isLoading, saveCookies, clearCookies } = useCookies();

  const handleSave = async () => {
    if (!rawInput.trim()) return;
    const success = await saveCookies(rawInput, format);
    if (success) {
      setRawInput("");
      setIsOpen(false);
    }
  };

  const handleClear = async () => {
    await clearCookies();
    setIsOpen(false);
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        id="cookie-manager-btn"
        onClick={() => setIsOpen(true)}
        className={cn(
          "btn-ghost relative",
          hasSession && "border-brand-500/40 text-brand-400"
        )}
      >
        {hasSession ? (
          <CheckCircle className="w-4 h-4 text-emerald-400" />
        ) : (
          <Cookie className="w-4 h-4" />
        )}
        <span className="hidden sm:inline">
          {hasSession ? `${cookieCount} Cookies` : "Set Cookies"}
        </span>
        {hasSession && (
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-400 rounded-full animate-pulse-brand" />
        )}
      </button>

      {/* Modal Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setIsOpen(false)}
        >
          <div className="glass-card w-full max-w-2xl animate-slide-up">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-brand-500/20 flex items-center justify-center border border-brand-500/30">
                  <ShieldCheck className="w-5 h-5 text-brand-400" />
                </div>
                <div>
                  <h2 className="font-semibold text-white">Cookie Manager</h2>
                  <p className="text-xs text-slate-500">Session TikTok untuk akses konten</p>
                </div>
              </div>
              <button
                id="cookie-modal-close"
                onClick={() => setIsOpen(false)}
                className="btn-ghost p-2"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Session Status */}
            {hasSession && savedAt && (
              <div className="mx-6 mt-6 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-emerald-300 font-medium">Session Aktif</p>
                  <p className="text-xs text-emerald-500/70">
                    {cookieCount} cookie tersimpan · Disimpan {formatRelativeTime(savedAt)}
                  </p>
                </div>
                <button
                  id="cookie-clear-btn"
                  onClick={handleClear}
                  className="btn-ghost text-rose-400 border-rose-500/30 hover:border-rose-400/50 text-xs px-3 py-1.5"
                  disabled={isLoading}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Hapus
                </button>
              </div>
            )}

            {/* Body */}
            <div className="p-6 space-y-4">
              {/* Format Tabs */}
              <div>
                <p className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wide">Format Cookies</p>
                <div className="flex gap-1 glass-card p-1">
                  {FORMAT_TABS.map((tab) => (
                    <button
                      key={tab.value}
                      id={`format-${tab.value}`}
                      onClick={() => setFormat(tab.value)}
                      className={cn(
                        "flex-1 py-1.5 px-3 rounded-lg text-sm font-medium transition-all duration-150",
                        format === tab.value
                          ? "bg-brand-500 text-white"
                          : "text-slate-400 hover:text-slate-200"
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-600 mt-2">
                  {FORMAT_TABS.find((t) => t.value === format)?.hint}
                </p>
              </div>

              {/* Cookie Input */}
              <div>
                <label className="text-xs text-slate-500 font-medium uppercase tracking-wide block mb-2">
                  Paste Cookies
                </label>
                <textarea
                  id="cookie-input"
                  value={rawInput}
                  onChange={(e) => setRawInput(e.target.value)}
                  placeholder={PLACEHOLDER[format]}
                  className="input-brand min-h-[160px] resize-none font-mono text-xs"
                  spellCheck={false}
                />
              </div>

              {/* Warning */}
              <div className="p-3 rounded-xl bg-amber-500/8 border border-amber-500/20 flex items-start gap-2">
                <XCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-300/80">
                  Cookies disimpan sebagai session terenkripsi. Jangan bagikan cookies Anda kepada siapapun. Cookies hanya digunakan untuk mengakses TikTok atas nama Anda.
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  id="cookie-save-btn"
                  onClick={handleSave}
                  disabled={isLoading || !rawInput.trim()}
                  className="btn-brand flex-1"
                >
                  {isLoading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</>
                  ) : (
                    <><ShieldCheck className="w-4 h-4" /> Simpan Cookies</>
                  )}
                </button>
                <button
                  id="cookie-cancel-btn"
                  onClick={() => setIsOpen(false)}
                  className="btn-ghost"
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
