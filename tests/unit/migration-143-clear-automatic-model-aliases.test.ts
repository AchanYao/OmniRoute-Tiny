import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migration = fs.readFileSync(
  path.join(__dirname, "../../src/lib/db/migrations/143_clear_automatic_model_aliases.sql"),
  "utf8"
);

function makeDb() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE key_value (
      namespace TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      PRIMARY KEY (namespace, key)
    );
    CREATE TABLE combos (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE model_combo_mappings (
      id INTEGER PRIMARY KEY,
      model_pattern TEXT NOT NULL,
      combo_id TEXT NOT NULL
    );
  `);
  return db;
}

test("143 clears only database modelAliases and is idempotent", () => {
  const db = makeDb();
  const insert = db.prepare("INSERT INTO key_value (namespace, key, value) VALUES (?, ?, ?)");
  insert.run("modelAliases", "gpt-5.6-sol", JSON.stringify("seefs/gpt-5.6-sol"));
  insert.run("providerAliases", "seefs", JSON.stringify({ fast: "gpt-5.6-sol" }));
  insert.run("settings", "modelAliases", JSON.stringify({ legacy: "replacement" }));
  insert.run("syncedAvailableModels", "seefs", JSON.stringify([{ id: "gpt-5.6-sol" }]));
  db.prepare(
    "INSERT INTO combos (id, name, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
  ).run("combo-1", "gpt-5.6-sol", JSON.stringify({ models: [] }), "now", "now");
  db.prepare("INSERT INTO model_combo_mappings (id, model_pattern, combo_id) VALUES (?, ?, ?)").run(
    1,
    "gpt-5.6-sol",
    "combo-1"
  );

  db.exec(migration);
  db.exec(migration);

  assert.deepEqual(
    db.prepare("SELECT namespace, key, value FROM key_value ORDER BY namespace").all(),
    [
      {
        namespace: "providerAliases",
        key: "seefs",
        value: JSON.stringify({ fast: "gpt-5.6-sol" }),
      },
      {
        namespace: "settings",
        key: "modelAliases",
        value: JSON.stringify({ legacy: "replacement" }),
      },
      {
        namespace: "syncedAvailableModels",
        key: "seefs",
        value: JSON.stringify([{ id: "gpt-5.6-sol" }]),
      },
    ]
  );
  const comboCount = db.prepare("SELECT COUNT(*) AS count FROM combos").get();
  const mappingCount = db.prepare("SELECT COUNT(*) AS count FROM model_combo_mappings").get();
  assert.ok(comboCount && typeof comboCount === "object" && "count" in comboCount);
  assert.ok(mappingCount && typeof mappingCount === "object" && "count" in mappingCount);
  assert.equal(comboCount.count, 1);
  assert.equal(mappingCount.count, 1);
  db.close();
});
