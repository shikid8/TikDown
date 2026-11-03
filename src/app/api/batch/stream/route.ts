// ─── API: GET /api/batch/stream?taskId= (Server-Sent Events) ─────────────────
// Menggantikan polling interval di client dengan push notification dari server.
// Client cukup buka satu koneksi EventSource dan server akan mengirim update
// setiap kali status task berubah.

import { NextRequest } from "next/server";
import { tasksStore } from "@/lib/batchStore";

export const runtime = "nodejs";

// Nonaktifkan cache agar SSE berjalan benar
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const taskId = req.nextUrl.searchParams.get("taskId");

  if (!taskId) {
    return new Response("taskId diperlukan", { status: 400 });
  }

  const encoder = new TextEncoder();

  // ── Helper: format pesan SSE ───────────────────────────────────────────────
  const sseMessage = (data: unknown) =>
    encoder.encode(`data: ${JSON.stringify(data)}\n\n`);

  const stream = new ReadableStream({
    start(controller) {
      // Kirim heartbeat awal agar koneksi langsung terbuka
      controller.enqueue(encoder.encode(": heartbeat\n\n"));

      // Jika task langsung tidak ditemukan
      if (!tasksStore.has(taskId)) {
        controller.enqueue(sseMessage({ error: "Task tidak ditemukan" }));
        controller.close();
        return;
      }

      // Poll internal setiap 500ms dan push ke client jika ada perubahan
      let lastSnapshot = "";

      const intervalId = setInterval(() => {
        const task = tasksStore.get(taskId);

        if (!task) {
          controller.enqueue(sseMessage({ error: "Task tidak ditemukan" }));
          clearInterval(intervalId);
          controller.close();
          return;
        }

        // Hanya kirim jika ada perubahan state (hindari data duplikat)
        const snapshot = JSON.stringify(task);
        if (snapshot !== lastSnapshot) {
          lastSnapshot = snapshot;
          try {
            controller.enqueue(sseMessage(task));
          } catch {
            clearInterval(intervalId);
            return;
          }
        }

        // Tutup stream saat batch selesai
        if (task.isComplete) {
          clearInterval(intervalId);
          try {
            controller.close();
          } catch {}
        }
      }, 500);

      // Bersihkan interval saat client disconnect
      req.signal.addEventListener("abort", () => {
        clearInterval(intervalId);
        try {
          controller.close();
        } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Nonaktifkan buffering Nginx (Render/proxy)
    },
  });
}

