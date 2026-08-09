export const BUILD_PROFILES = ["full", "minimal", "backend", "gateway"] as const;

export type BuildProfile = (typeof BUILD_PROFILES)[number];

export interface BuildCapabilities {
  gateway: boolean;
  mcp: boolean;
  skills: boolean;
  memory: boolean;
  promptCompression: boolean;
  agentProtocols: boolean;
  plugins: boolean;
  dashboardExtensions: boolean;
}

type BuildProfileEnvironment = Record<string, string | undefined>;

const FULL_CAPABILITIES: Readonly<BuildCapabilities> = Object.freeze({
  gateway: true,
  mcp: true,
  skills: true,
  memory: true,
  promptCompression: true,
  agentProtocols: true,
  plugins: true,
  dashboardExtensions: true,
});

const GATEWAY_CAPABILITIES: Readonly<BuildCapabilities> = Object.freeze({
  gateway: true,
  mcp: false,
  skills: false,
  memory: false,
  promptCompression: false,
  agentProtocols: false,
  plugins: false,
  dashboardExtensions: false,
});

export function resolveBuildProfile(env: BuildProfileEnvironment): BuildProfile {
  const value = (env.OMNIROUTE_BUILD_PROFILE ?? env.NEXT_PUBLIC_OMNIROUTE_BUILD_PROFILE)
    ?.trim()
    .toLowerCase();
  return BUILD_PROFILES.includes(value as BuildProfile) ? (value as BuildProfile) : "full";
}

export function getBuildCapabilities(profile: BuildProfile): Readonly<BuildCapabilities> {
  return profile === "gateway" ? GATEWAY_CAPABILITIES : FULL_CAPABILITIES;
}

export function isGatewayBuild(env: BuildProfileEnvironment): boolean {
  return resolveBuildProfile(env) === "gateway";
}
