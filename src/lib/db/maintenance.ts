/**
 * Dedicated SQLite handle for blocking maintenance (VACUUM, PRAGMA quick_check,
 * page_size / auto_vacuum, wal_checkpoint).
 *
 * better-sqlite3 serializes statements on a single connection. Running VACUUM
 * or quick_check on the request singleton parks every query on that handle.
 * A second native connection lets the request singleton keep serving while
 * maintenance holds the file lock.
 *
 * sql.js and in-memory databases cannot host a second independent file-backed
 * connection; those fall back to the primary singleton.
 */

import type { SqliteAdapter } from "./adapters/types";
import { tryOpenSync } from "./adapters/driverFactory";
import {
  SQLITE_FILE,
  closeProbeIfSafe,
  closeDbInstance,
  getDbInstance,
  isBuildPhase,
  isCloud,
} from "./core";
import {
  applyDatabaseOptimizationSettingsForDb,
  setAutoVacuumForDb,
  setPageSizeForDb,
} from "./optimizationSettings";
import { registerDbStateResetter } from "./stateReset";
import type { DatabaseSettings } from "@/types/databaseSettings";
import { flushAllSyncBatchWriters } from "../usage/sqliteWriteBatch";

type SqliteDatabase = SqliteAdapter;
type CheckpointMode = "PASSIVE" | "FULL" | "RESTART" | "TRUNCATE";
type DatabaseOptimizationSettings = DatabaseSettings["optimization"];

export type MaintenanceVacuumResult = {
  success: boolean;
  duration: number;
  error?: string;
};

declare global {
  var __omnirouteMaintenanceDb: SqliteAdapter | undefined;
}

function getHandle(): SqliteDatabase | null {
  return globalThis.__omnirouteMaintenanceDb ?? null;
}

function setHandle(db: SqliteDatabase | null): void {
  if (db) {
    globalThis.__omnirouteMaintenanceDb = db;
  } else {
    delete globalThis.__omnirouteMaintenanceDb;
  }
}

function configureMaintenanceHandle(db: SqliteDatabase): void {
  try {
    db.pragma("busy_timeout = 2000");
    db.pragma("synchronous = NORMAL");
    db.pragma("temp_store = MEMORY");
    db.pragma("journal_mode = WAL");
  } catch {
    // in-memory / sql.js / readonly probes may reject some pragmas
  }
}

function configureExclusiveMaintenanceHandle(db: SqliteDatabase): void {
  db.pragma("busy_timeout = 2000");
  db.pragma("synchronous = NORMAL");
  db.pragma("temp_store = MEMORY");
}

function openSecondaryHandle(sqliteFile: string, primary: SqliteDatabase): SqliteDatabase | null {
  try {
    const adapter = tryOpenSync(sqliteFile);
    if (!adapter || adapter === primary || adapter.driver === "sql.js") return null;
    return adapter;
  } catch {
    return null;
  }
}

/**
 * Returns a SQLite handle that is not the request singleton when a native
 * driver can open a second connection to the same file.
 */
export function getMaintenanceDbInstance(primaryDb?: SqliteDatabase): SqliteDatabase {
  const existing = getHandle();
  if (existing?.open) return existing;

  if (isCloud || isBuildPhase || !SQLITE_FILE) {
    return getDbInstance();
  }

  const primary = primaryDb ?? getDbInstance();
  if (primary.driver === "sql.js") return primary;

  const opened = openSecondaryHandle(SQLITE_FILE, primary);
  if (!opened) return primary;

  configureMaintenanceHandle(opened);
  setHandle(opened);
  return opened;
}

export function closeMaintenanceDbInstance(): void {
  const handle = getHandle();
  if (!handle) return;
  setHandle(null);
  if (handle.driver === "sql.js") return;
  try {
    closeProbeIfSafe(handle);
  } catch {
    /* already closed */
  }
}

registerDbStateResetter(closeMaintenanceDbInstance);

export function runMaintenanceVacuum(): MaintenanceVacuumResult {
  const db = getMaintenanceDbInstance();
  const startTime = Date.now();

  try {
    console.log("[DB] Starting VACUUM on maintenance connection...");
    db.exec("VACUUM");
    const duration = Date.now() - startTime;
    console.log(`[DB] VACUUM completed in ${duration}ms`);
    return { success: true, duration };
  } catch (err: unknown) {
    const duration = Date.now() - startTime;
    console.error("[DB] VACUUM failed:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, duration, error: message };
  }
}

export function runMaintenanceQuickCheck(): "ok" | "error" | null {
  try {
    const result = getMaintenanceDbInstance().pragma("quick_check", { simple: true }) as string;
    return result === "ok" ? "ok" : "error";
  } catch {
    return null;
  }
}

export function runMaintenanceWalCheckpoint(mode: CheckpointMode = "TRUNCATE"): boolean {
  if (isCloud || isBuildPhase || !SQLITE_FILE) return false;
  getMaintenanceDbInstance().pragma(`wal_checkpoint(${mode})`);
  return true;
}

export function applyMaintenanceOptimizationSettings(settings: DatabaseOptimizationSettings): void {
  const db = getMaintenanceDbInstance();
  const autoVacuumChanged =
    String(db.pragma("auto_vacuum", { simple: true })) !==
    String(
      settings.autoVacuumMode === "FULL" ? 1 : settings.autoVacuumMode === "INCREMENTAL" ? 2 : 0
    );
  const pageSizeChanged =
    Number(db.pragma("page_size", { simple: true })) !== Number(settings.pageSize);

  if (autoVacuumChanged || pageSizeChanged) {
    runExclusivePersistentMaintenance((exclusiveDb) => {
      applyDatabaseOptimizationSettingsForDb(exclusiveDb, settings, { applyPersistent: true });
    });
  }

  applyDatabaseOptimizationSettingsForDb(getDbInstance(), settings, { applyPersistent: false });
}

export function setMaintenanceAutoVacuum(mode: "NONE" | "FULL" | "INCREMENTAL"): void {
  runExclusivePersistentMaintenance((db) => setAutoVacuumForDb(db, mode));
}

export function setMaintenancePageSize(pageSize: number): void {
  runExclusivePersistentMaintenance((db) => setPageSizeForDb(db, pageSize));
}

function runExclusivePersistentMaintenance(operation: (db: SqliteDatabase) => void): void {
  if (isCloud || isBuildPhase || !SQLITE_FILE) {
    operation(getDbInstance());
    return;
  }

  const primary = getDbInstance();
  if (primary.driver === "sql.js") {
    flushAllSyncBatchWriters();
    operation(primary);
    return;
  }

  flushAllSyncBatchWriters();
  closeMaintenanceDbInstance();
  closeDbInstance({ checkpointMode: "TRUNCATE" });
  const exclusiveDb = tryOpenSync(SQLITE_FILE);
  if (!exclusiveDb) throw new Error("Unable to open SQLite maintenance connection");

  try {
    configureExclusiveMaintenanceHandle(exclusiveDb);
    operation(exclusiveDb);
  } finally {
    closeProbeIfSafe(exclusiveDb);
  }
}
