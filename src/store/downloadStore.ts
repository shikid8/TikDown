// ─── Zustand Download Store ───────────────────────────────────────────────────
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DownloadTask, DownloadHistoryItem } from "@/types/download";
import type { TikTokVideoInfo } from "@/types/tiktok";
import { generateTaskId } from "@/lib/utils";

interface DownloadStore {
  // Current video preview
  currentVideo: TikTokVideoInfo | null;
  setCurrentVideo: (video: TikTokVideoInfo | null) => void;

  // Download tasks
  tasks: DownloadTask[];
  addTask: (
    url: string,
    quality: DownloadTask["quality"],
    format: DownloadTask["format"]
  ) => string;
  updateTask: (id: string, updates: Partial<DownloadTask>) => void;
  removeTask: (id: string) => void;
  clearCompletedTasks: () => void;

  // History
  history: DownloadHistoryItem[];
  addToHistory: (item: DownloadHistoryItem) => void;
  clearHistory: () => void;

  // UI State
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  mode: "single" | "batch";
  setMode: (mode: "single" | "batch") => void;
}

export const useDownloadStore = create<DownloadStore>()(
  persist(
    (set) => ({
      // Current video
      currentVideo: null,
      setCurrentVideo: (video) => set({ currentVideo: video }),

      // Tasks
      tasks: [],
      addTask: (url, quality, format) => {
        const id = generateTaskId();
        const task: DownloadTask = {
          id,
          url,
          quality,
          format,
          status: "pending",
          progress: 0,
          createdAt: Date.now(),
        };
        set((state) => ({ tasks: [task, ...state.tasks] }));
        return id;
      },
      updateTask: (id, updates) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id ? { ...t, ...updates } : t
          ),
        })),
      removeTask: (id) =>
        set((state) => ({
          tasks: state.tasks.filter((t) => t.id !== id),
        })),
      clearCompletedTasks: () =>
        set((state) => ({
          tasks: state.tasks.filter(
            (t) => t.status !== "done" && t.status !== "failed"
          ),
        })),

      // History
      history: [],
      addToHistory: (item) =>
        set((state) => ({
          history: [item, ...state.history].slice(0, 100), // max 100 items
        })),
      clearHistory: () => set({ history: [] }),

      // UI
      isLoading: false,
      setIsLoading: (loading) => set({ isLoading: loading }),
      mode: "single",
      setMode: (mode) => set({ mode }),
    }),
    {
      name: "tiktok-downloader-store",
      partialize: (state) => ({
        history: state.history,
        mode: state.mode,
      }),
    }
  )
);
