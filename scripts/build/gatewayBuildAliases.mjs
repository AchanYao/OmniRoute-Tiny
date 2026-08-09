const DISABLED_MODULE_STUB = "./src/lib/build-profile/disabledModule.stub.ts";

const GATEWAY_DISABLED_MODULES = Object.freeze([
  "@/lib/memory/extraction",
  "@/lib/memory/index",
  "@/lib/memory/injection",
  "@/lib/memory/retrieval",
  "@/lib/memory/settings",
  "@/lib/memory/typedDecay",
  "@/lib/plugins/hooks",
  "@/lib/plugins/manager",
  "@/lib/skills/builtins",
  "@/lib/skills/executor",
  "@/lib/skills/injection",
  "@/lib/skills/interception",
  "@omniroute/open-sse/mcp-server/audit.ts",
]);

export function gatewayBuildAliasesFor(env = process.env) {
  if (env.OMNIROUTE_BUILD_PROFILE?.trim().toLowerCase() !== "gateway") return {};
  return Object.fromEntries(
    GATEWAY_DISABLED_MODULES.map((moduleName) => [moduleName, DISABLED_MODULE_STUB])
  );
}
