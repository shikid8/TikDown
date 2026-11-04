// ─── Shared Batch Task Store ──────────────────────────────────────────────────
// Module-level Map agar bisa diakses oleh batch/route.ts dan batch/stream/route.ts
// dalam proses Node.js yang sama (Render, dev server).

export interface BatchTask {
  id: string;
  isComplete: boolean;
  items: BatchTaskItem[];
}

export interface BatchTaskItem {
  id: string;
  url: string;
  status: "pending" | "processing" | "success" | "error" | "skipped";
  progress?: number;
  message?: string;
  data?: {
    title: string;
    size?: number;
    downloadUrl?: string;
    format?: string;
    uploadDate?: string;
    uploadTimestamp?: number;
  };
}

export const tasksStore = new Map<string, BatchTask>();

/**
 * Jadwalkan penghapusan task dari store setelah delay tertentu.
 * Default: 10 menit setelah task selesai.
 */
export function scheduleCleanup(taskId: string, delayMs = 10 * 60 * 1000) {
  setTimeout(() => {
    tasksStore.delete(taskId);
    console.info(`[BatchStore] Task ${taskId} dihapus dari store (cleanup)`);
  }, delayMs);
}

