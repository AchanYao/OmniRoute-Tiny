export const GATEWAY_FEATURE_DISABLED = true;

export const DEFAULT_MEMORY_SETTINGS = Object.freeze({
  enabled: false,
  maxTokens: 0,
  skillsEnabled: false,
});

export async function getMemorySettings() {
  return DEFAULT_MEMORY_SETTINGS;
}

export function invalidateMemorySettingsCache(): void {}

export function toMemoryRetrievalConfig(): Record<string, never> {
  return {};
}

export async function retrieveMemories(): Promise<never[]> {
  return [];
}

export function formatMemoryContext(): string {
  return "";
}

export function injectMemory<T>(body: T): T {
  return body;
}

export function shouldInjectMemory(): boolean {
  return false;
}

export function extractFacts(): void {}

export function startMemoryDecaySweep(): void {}

export function initMemoryBackends(): void {}

export function injectSkills({ existingTools = [] }: { existingTools?: unknown[] }): unknown[] {
  return existingTools;
}

export async function handleToolCallExecution<T>(response: T): Promise<T> {
  return response;
}

export const skillExecutor = Object.freeze({});

export function registerBuiltinSkills(): void {}

export async function runOnError(): Promise<void> {}

export const pluginManager = Object.freeze({
  async loadAll(): Promise<void> {},
});

export function closeAuditDb(): boolean {
  return false;
}
