import type { RegistryEntry } from "../../shared.ts";
import { CURSOR_REGISTRY_VERSION, getCursorRegistryHeaders } from "../../shared.ts";

export const cursorProvider: RegistryEntry = {
  id: "cursor",
  alias: "cu",
  format: "cursor",
  executor: "cursor",
  baseUrl: "https://api2.cursor.sh",
  chatPath: "/aiserver.v1.ChatService/StreamUnifiedChatWithTools",
  authType: "oauth",
  authHeader: "bearer",
  defaultContextLength: 200000,
  headers: getCursorRegistryHeaders(),
  clientVersion: CURSOR_REGISTRY_VERSION,
  passthroughModels: true,
  models: [],
};

export const cursorOAuthProvider: RegistryEntry = {
  ...cursorProvider,
  id: "cursor-oauth",
  alias: "cuo",
};
