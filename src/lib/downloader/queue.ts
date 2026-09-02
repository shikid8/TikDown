import pLimit from "p-limit";

// Limit concurrent downloads to prevent overloading the server or getting rate-limited
// Setting to 3 as a safe default for TikTok API.
const limit = pLimit(3);

export class DownloadQueue {
  private static instance: DownloadQueue;
  private tasks = new Map<string, any>();

  private constructor() {}

  public static getInstance(): DownloadQueue {
    if (!DownloadQueue.instance) {
      DownloadQueue.instance = new DownloadQueue();
    }
    return DownloadQueue.instance;
  }

  /**
   * Adds a task to the queue with concurrency limit.
   */
  public async add<T>(taskId: string, fn: () => Promise<T>): Promise<T> {
    this.tasks.set(taskId, { status: "pending" });
    
    return limit(async () => {
      this.tasks.set(taskId, { status: "processing" });
      try {
        const result = await fn();
        this.tasks.set(taskId, { status: "completed", result });
        return result;
      } catch (error) {
        this.tasks.set(taskId, { status: "failed", error });
        throw error;
      }
    });
  }

  public getStatus(taskId: string) {
    return this.tasks.get(taskId);
  }
}

export const downloadQueue = DownloadQueue.getInstance();
