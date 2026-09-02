// ─── useCookies Hook ──────────────────────────────────────────────────────────
"use client";

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import type { CookieFormat } from "@/types/cookie";

interface CookieState {
  hasSession: boolean;
  sessionId: string | null;
  cookieCount: number;
  savedAt: number | null;
}

export function useCookies() {
  const [state, setState] = useState<CookieState>({
    hasSession: false,
    sessionId: null,
    cookieCount: 0,
    savedAt: null,
  });
  const [isLoading, setIsLoading] = useState(false);

  // Check if we have a session on mount
  useEffect(() => {
    const saved = localStorage.getItem("tk_cookie_meta");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as CookieState;
        setState(parsed);
      } catch {}
    }
  }, []);

  /**
   * Save cookies via API
   */
  const saveCookies = useCallback(
    async (rawCookies: string, format: CookieFormat): Promise<boolean> => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/cookies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cookies: rawCookies, format }),
        });

        const data = await res.json();

        if (!data.success) {
          toast.error(data.error ?? "Gagal menyimpan cookies.");
          return false;
        }

        const newState: CookieState = {
          hasSession: true,
          sessionId: data.sessionId,
          cookieCount: data.cookieCount ?? 0,
          savedAt: Date.now(),
        };

        setState(newState);
        localStorage.setItem("tk_cookie_meta", JSON.stringify(newState));
        toast.success(`✅ ${data.message}`);
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Terjadi kesalahan.";
        toast.error(message);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Clear cookies session
   */
  const clearCookies = useCallback(async () => {
    setIsLoading(true);
    try {
      await fetch("/api/cookies", { method: "DELETE" });
      setState({ hasSession: false, sessionId: null, cookieCount: 0, savedAt: null });
      localStorage.removeItem("tk_cookie_meta");
      toast.success("Cookies berhasil dihapus.");
    } catch {
      toast.error("Gagal menghapus cookies.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    ...state,
    isLoading,
    saveCookies,
    clearCookies,
  };
}
