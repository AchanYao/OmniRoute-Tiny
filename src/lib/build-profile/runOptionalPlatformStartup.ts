import type { BuildCapabilities } from "@/shared/constants/buildProfile";

export interface OptionalPlatformStartupDependencies {
  registerBuiltinSkills?: () => Promise<void> | void;
  loadPlugins?: () => Promise<void> | void;
}

export interface OptionalPlatformStartupResult {
  skills: "started" | "skipped";
  plugins: "started" | "skipped";
}

export async function runOptionalPlatformStartup(
  capabilities: Readonly<BuildCapabilities>,
  dependencies: OptionalPlatformStartupDependencies
): Promise<OptionalPlatformStartupResult> {
  const result: OptionalPlatformStartupResult = {
    skills: "skipped",
    plugins: "skipped",
  };

  if (capabilities.skills && dependencies.registerBuiltinSkills) {
    await dependencies.registerBuiltinSkills();
    result.skills = "started";
  }

  if (capabilities.plugins && dependencies.loadPlugins) {
    await dependencies.loadPlugins();
    result.plugins = "started";
  }

  return result;
}
