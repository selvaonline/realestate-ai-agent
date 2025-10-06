// src/comet/queue.ts
// Simple in-memory queue for MVP (upgrade to BullMQ + Redis in Phase 2)

export type CometJob = {
  watchId: string;
  timestamp: number;
};

class SimpleQueue {
  private queue: CometJob[] = [];
  private processing = false;
  private handlers: Array<(job: CometJob) => Promise<void>> = [];

  enqueue(job: CometJob) {
    this.queue.push(job);
    console.log(`[comet-queue] Enqueued job for watch ${job.watchId}`);
    this.process();
  }

  onJob(handler: (job: CometJob) => Promise<void>) {
    this.handlers.push(handler);
  }

  private async process() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const job = this.queue.shift();
      if (!job) break;

      console.log(`[comet-queue] Processing job for watch ${job.watchId}`);
      
      for (const handler of this.handlers) {
        try {
          await handler(job);
        } catch (err) {
          console.error(`[comet-queue] Job failed for ${job.watchId}:`, err);
        }
      }
    }

    this.processing = false;
  }
}

export const cometQueue = new SimpleQueue();

export function enqueueCometJob(watchId: string) {
  cometQueue.enqueue({ watchId, timestamp: Date.now() });
}
