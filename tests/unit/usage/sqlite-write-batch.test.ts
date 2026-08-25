import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { SyncBatchWriter } from "../../../src/lib/usage/sqliteWriteBatch.ts";

test("SyncBatchWriter persists buffered entries together at the size threshold", () => {
  const persisted: number[][] = [];
  const writer = new SyncBatchWriter<number>({
    flushIntervalMs: 60_000,
    maxBufferSize: 3,
    persistEntries: (entries) => persisted.push(entries),
  });

  writer.enqueue(1);
  writer.enqueue(2);
  assert.deepEqual(persisted, []);

  writer.enqueue(3);
  assert.deepEqual(persisted, [[1, 2, 3]]);
  writer.resetForTests();
});

test("SyncBatchWriter flush persists a partial batch immediately", () => {
  const persisted: string[][] = [];
  const writer = new SyncBatchWriter<string>({
    flushIntervalMs: 60_000,
    maxBufferSize: 100,
    persistEntries: (entries) => persisted.push(entries),
  });

  writer.enqueue("a");
  writer.enqueue("b");
  const result = writer.flush();

  assert.deepEqual(result, { flushedEntries: 2, requeued: false });
  assert.deepEqual(persisted, [["a", "b"]]);
  writer.resetForTests();
});

test("SyncBatchWriter can discard failed test batches instead of retrying", () => {
  const writer = new SyncBatchWriter<number>({
    flushIntervalMs: 60_000,
    maxBufferSize: 100,
    persistEntries: () => {
      throw new Error("temporary database removed");
    },
    logger: { error() {} },
    requeueOnError: false,
  });

  writer.enqueue(1);
  assert.deepEqual(writer.flush(), { flushedEntries: 0, requeued: false });
  assert.deepEqual(writer.flush(), { flushedEntries: 0, requeued: false });
  writer.resetForTests();
});

test("SyncBatchWriter can disable process-exit flushing for isolated test databases", () => {
  const persisted: number[][] = [];
  const writer = new SyncBatchWriter<number>({
    flushIntervalMs: 60_000,
    maxBufferSize: 100,
    persistEntries: (entries) => persisted.push(entries),
    flushOnProcessExit: false,
  });

  writer.enqueue(1);
  writer.flushForProcessExit();
  assert.deepEqual(persisted, []);
  assert.deepEqual(writer.flush(), { flushedEntries: 1, requeued: false });
  writer.resetForTests();
});

test("graceful shutdown flushes call logs and usage history before closing SQLite", () => {
  const source = fs.readFileSync("src/lib/gracefulShutdown.ts", "utf8");

  assert.match(source, /flushCallLogBatchWriter/);
  assert.match(source, /flushUsageHistoryBatchWriter/);
  assert.ok(
    source.indexOf("flushCallLogBatchWriter") < source.indexOf("closeDbInstance()"),
    "call log flush must happen before the database is closed"
  );
  assert.ok(
    source.indexOf("flushUsageHistoryBatchWriter") < source.indexOf("closeDbInstance()"),
    "usage history flush must happen before the database is closed"
  );
});
