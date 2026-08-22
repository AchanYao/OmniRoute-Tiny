import type { RegistryEntry } from "../../shared.ts";

export const qwen_cloud_token_planProvider: RegistryEntry = {
  id: "qwen-cloud-token-plan",
  format: "openai",
  executor: "default",
  baseUrl:
    "https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions",
  modelsUrl: "https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/models",
  authType: "apikey",
  authHeader: "bearer",
  models: [],
  passthroughModels: true,
};
