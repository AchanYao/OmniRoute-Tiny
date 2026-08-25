export interface SyncBatchWriterOptions<T> {
  flushIntervalMs?: number;
  maxBufferSize?: number;
  persistEntries: (entries: T[]) => void;
  logger?: Pick<Console, "error">;
  requeueOnError?: boolean;
  flushOnProcessExit?: boolean;
}

export interface SyncBatchFlushResult {
  flushedEntries: number;
  requeued: boolean;
}

const DEFAULT_FLUSH_INTERVAL_MS = 1_000;
const DEFAULT_MAX_BUFFER_SIZE = 100;
const MAX_REQUEUE_BUFFER_MULTIPLIER = 10;

interface ProcessExitBatchWriter {
  flush(): SyncBatchFlushResult;
  flushForProcessExit(): void;
}

declare global {
  var __omnirouteProcessExitBatchWriters: Set<ProcessExitBatchWriter> | undefined;
  var __omnirouteProcessExitBatchHooksRegistered: boolean | undefined;
}

function flushProcessExitBatchWriters(): void {
  for (const writer of globalThis.__omnirouteProcessExitBatchWriters ?? []) {
    writer.flushForProcessExit();
  }
}

export function registerProcessExitBatchWriter(writer: ProcessExitBatchWriter): void {
  globalThis.__omnirouteProcessExitBatchWriters ??= new Set();
  globalThis.__omnirouteProcessExitBatchWriters.add(writer);

  if (globalThis.__omnirouteProcessExitBatchHooksRegistered) return;
  globalThis.__omnirouteProcessExitBatchHooksRegistered = true;
  process.prependListener("exit", flushProcessExitBatchWriters);
}

export function flushAllSyncBatchWriters(): void {
  for (const writer of globalThis.__omnirouteProcessExitBatchWriters ?? []) {
    writer.flush();
  }
}

export class SyncBatchWriter<T> implements ProcessExitBatchWriter {
  private buffer: T[] = [];
  private timer: NodeJS.Timeout | null = null;
  private readonly flushIntervalMs: number;
  private readonly maxBufferSize: number;
  private readonly persistEntries: (entries: T[]) => void;
  private readonly logger: Pick<Console, "error">;
  private readonly requeueOnError: boolean;
  private readonly flushOnProcessExit: boolean;

  constructor(options: SyncBatchWriterOptions<T>) {
    this.flushIntervalMs = options.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS;
    this.maxBufferSize = options.maxBufferSize ?? DEFAULT_MAX_BUFFER_SIZE;
    this.persistEntries = options.persistEntries;
    this.logger = options.logger ?? console;
    this.requeueOnError = options.requeueOnError ?? true;
    this.flushOnProcessExit = options.flushOnProcessExit ?? true;
  }

  enqueue(entry: T): SyncBatchFlushResult | null {
    this.buffer.push(entry);
    if (this.buffer.length >= this.maxBufferSize) return this.flush();
    this.armTimer();
    return null;
  }

  flush(): SyncBatchFlushResult {
    this.clearTimer();
    if (this.buffer.length === 0) return { flushedEntries: 0, requeued: false };

    const entries = this.buffer;
    this.buffer = [];
    try {
      this.persistEntries(entries);
      return { flushedEntries: entries.length, requeued: false };
    } catch (error) {
      if (this.requeueOnError) {
        const maxRequeueBufferSize = this.maxBufferSize * MAX_REQUEUE_BUFFER_MULTIPLIER;
        this.buffer = [...entries, ...this.buffer].slice(-maxRequeueBufferSize);
        this.armTimer();
      }
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`[SQLiteBatchWriter] Flush error: ${message}`);
      return { flushedEntries: 0, requeued: this.requeueOnError };
    }
  }

  flushForProcessExit(): void {
    if (this.flushOnProcessExit) this.flush();
  }

  resetForTests(): void {
    this.clearTimer();
    this.buffer = [];
  }

  getBufferedEntries(): readonly T[] {
    return this.buffer;
  }

  private armTimer(): void {
    if (this.timer || this.buffer.length === 0) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush();
    }, this.flushIntervalMs);
    this.timer.unref?.();
  }

  private clearTimer(): void {
    if (!this.timer) return;
    clearTimeout(this.timer);
    this.timer = null;
  }
}
