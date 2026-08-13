let modelAliasCacheVersion = 0;

export function getModelAliasCacheVersion(): number {
  return modelAliasCacheVersion;
}

export function bumpModelAliasCacheVersion(): void {
  modelAliasCacheVersion += 1;
}
