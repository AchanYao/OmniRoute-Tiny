/** db/models/aliases.ts — model alias CRUD (modelAliases namespace, providerAliases namespace). */

import { getDbInstance } from "../core";
import { backupDbFile } from "../backup";
import { getKeyValue } from "./shared";
import { bumpModelAliasCacheVersion } from "../../modelAliasCacheVersion";

export async function getModelAliases() {
  const db = getDbInstance();
  const rows = db
    .prepare("SELECT key, value FROM key_value WHERE namespace = 'modelAliases'")
    .all();
  const result: Record<string, unknown> = {};
  for (const row of rows) {
    const { key, value } = getKeyValue(row);
    if (!key || value === null) continue;
    result[key] = JSON.parse(value);
  }
  return result;
}

export async function setModelAlias(alias: string, model: unknown) {
  const db = getDbInstance();
  db.prepare(
    "INSERT OR REPLACE INTO key_value (namespace, key, value) VALUES ('modelAliases', ?, ?)"
  ).run(alias, JSON.stringify(model));
  bumpModelAliasCacheVersion();
  backupDbFile("pre-write");
}

export async function deleteModelAlias(alias: string) {
  const db = getDbInstance();
  db.prepare("DELETE FROM key_value WHERE namespace = 'modelAliases' AND key = ?").run(alias);
  bumpModelAliasCacheVersion();
  backupDbFile("pre-write");
}

// ──────── Provider-scoped aliases (#9068) ────────
// These survive rediscovery: an alias in this namespace is never touched by
// model sync, and always resolves the same way regardless of upstream ID changes.

export type ProviderAliasMap = Record<string, string>; // alias → upstream model ID

/**
 * Get the provider-scoped alias map for a given provider.
 * Returns `{}` when no aliases have been set.
 */
export function getProviderAliases(providerId: string): ProviderAliasMap {
  const db = getDbInstance();
  const row = db
    .prepare("SELECT value FROM key_value WHERE namespace = 'providerAliases' AND key = ?")
    .get(providerId);
  const parsed = getKeyValue(row).value;
  if (!parsed) return {};
  try {
    const v = JSON.parse(parsed);
    return typeof v === "object" && v !== null ? (v as ProviderAliasMap) : {};
  } catch {
    return {};
  }
}

/**
 * Set a provider-scoped alias.
 */
export function setProviderAlias(providerId: string, alias: string, upstreamModelId: string): void {
  const current = getProviderAliases(providerId);
  current[alias] = upstreamModelId;
  const db = getDbInstance();
  db.prepare(
    "INSERT OR REPLACE INTO key_value (namespace, key, value) VALUES ('providerAliases', ?, ?)"
  ).run(providerId, JSON.stringify(current));
  backupDbFile("pre-write");
}

/**
 * Remove a provider-scoped alias.
 */
export function removeProviderAlias(providerId: string, alias: string): void {
  const current = getProviderAliases(providerId);
  if (!(alias in current)) return;
  delete current[alias];
  const db = getDbInstance();
  if (Object.keys(current).length === 0) {
    db.prepare("DELETE FROM key_value WHERE namespace = 'providerAliases' AND key = ?").run(
      providerId
    );
  } else {
    db.prepare(
      "INSERT OR REPLACE INTO key_value (namespace, key, value) VALUES ('providerAliases', ?, ?)"
    ).run(providerId, JSON.stringify(current));
  }
  backupDbFile("pre-write");
}
