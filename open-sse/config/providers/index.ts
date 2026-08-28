import type { RegistryEntry } from "./shared.ts";
import { unorouterProvider } from "./registry/unorouter/index.ts";

import { aimlapiProvider } from "./registry/aimlapi/index.ts";
import { byteplusProvider } from "./registry/byteplus/index.ts";
import { ollama_cloudProvider } from "./registry/ollama-cloud/index.ts";
import { syntheticProvider } from "./registry/synthetic/index.ts";
import { ideogramProvider } from "./registry/ideogram/index.ts";
import { friendliaiProvider } from "./registry/friendliai/index.ts";
import { anthropicProvider } from "./registry/anthropic/index.ts";
import { sambanovaProvider } from "./registry/sambanova/index.ts";
import { puterProvider } from "./registry/puter/index.ts";
import { upstageProvider } from "./registry/upstage/index.ts";
import { nebiusProvider } from "./registry/nebius/index.ts";
import { fireworksProvider } from "./registry/fireworks/index.ts";
import { llamagateProvider } from "./registry/llamagate/index.ts";
import { glmProvider } from "./registry/glm/index.ts";
import { glmtProvider } from "./registry/glm/t/index.ts";
import { glm_cnProvider } from "./registry/glm/cn/index.ts";
import { traeProvider } from "./registry/trae/index.ts";
import { raycastProvider } from "./registry/raycast/index.ts";
import { kilocodeProvider } from "./registry/kilocode/index.ts";
import { github_modelsProvider } from "./registry/github/models/index.ts";
import { githubProvider } from "./registry/github/index.ts";
import { gheCopilotProvider } from "./registry/ghe-copilot/index.ts";
import { difyProvider } from "./registry/dify/index.ts";
import { ovhcloudProvider } from "./registry/ovhcloud/index.ts";
import { claudeProvider } from "./registry/claude/index.ts";
import { bedrockProvider } from "./registry/bedrock/index.ts";
import { xiaomi_mimoProvider } from "./registry/xiaomi-mimo/index.ts";
import { xiaomi_mimo_token_planProvider } from "./registry/xiaomi-mimo-token-plan/index.ts";
import { codestralProvider } from "./registry/codestral/index.ts";
import { wandbProvider } from "./registry/wandb/index.ts";
import { predibaseProvider } from "./registry/predibase/index.ts";
import { baichuanProvider } from "./registry/baichuan/index.ts";
import { yiProvider } from "./registry/yi/index.ts";
import { deepseekProvider } from "./registry/deepseek/index.ts";
import { dgridProvider } from "./registry/dgrid/index.ts";
import { baiProvider } from "./registry/bai/index.ts";
import { qiniuProvider } from "./registry/qiniu/index.ts";
import { kimi_coding_apikeyProvider } from "./registry/kimi/coding-apikey/index.ts";
import { kimi_codingProvider } from "./registry/kimi/coding/index.ts";
import { kimiProvider } from "./registry/kimi/index.ts";
import { groqProvider } from "./registry/groq/index.ts";
import { inference_netProvider } from "./registry/inference-net/index.ts";
import { llm7Provider } from "./registry/llm7/index.ts";
import { cerebrasProvider } from "./registry/cerebras/index.ts";
import { charmHyperProvider } from "./registry/charm-hyper/index.ts";
import { nubeProvider } from "./registry/nube/index.ts";
import { clinepassProvider } from "./registry/clinepass/index.ts";
import { sparkdeskProvider } from "./registry/sparkdesk/index.ts";
import { nlpcloudProvider } from "./registry/nlpcloud/index.ts";
import { nvidiaProvider } from "./registry/nvidia/index.ts";
import { api_airforceProvider } from "./registry/api-airforce/index.ts";
import { mistralProvider } from "./registry/mistral/index.ts";
import { togetherProvider } from "./registry/together/index.ts";
import { cohereProvider } from "./registry/cohere/index.ts";
import { cursorProvider, cursorOAuthProvider } from "./registry/cursor/index.ts";
import { volcengineProvider } from "./registry/volcengine/index.ts";
import { hackclubProvider } from "./registry/hackclub/index.ts";
import { freetheaiProvider } from "./registry/freetheai/index.ts";
import { g4f_groqProvider } from "./registry/g4f-groq/index.ts";
import { g4f_geminiProvider } from "./registry/g4f-gemini/index.ts";
import { g4f_pollinationsProvider } from "./registry/g4f-pollinations/index.ts";
import { g4f_ollamaProvider } from "./registry/g4f-ollama/index.ts";
import { g4f_nvidiaProvider } from "./registry/g4f-nvidia/index.ts";
import { tencentProvider } from "./registry/tencent/index.ts";
import { cozeProvider } from "./registry/coze/index.ts";
import { ai21Provider } from "./registry/ai21/index.ts";
import { publicaiProvider } from "./registry/publicai/index.ts";
import { featherless_aiProvider } from "./registry/featherless-ai/index.ts";
import { antigravityProvider } from "./registry/antigravity/index.ts";
import { openaiProvider } from "./registry/openai/index.ts";
import { snowflakeProvider } from "./registry/snowflake/index.ts";
import { huggingfaceProvider } from "./registry/huggingface/index.ts";
import { freeaiapikeyProvider } from "./registry/freeaiapikey/index.ts";
import { qwen_cloudProvider } from "./registry/qwen-cloud/index.ts";
import { qwen_cloud_token_planProvider } from "./registry/qwen-cloud-token-plan/index.ts";
import { modalProvider } from "./registry/modal/index.ts";
import { zenmuxProvider } from "./registry/zenmux/index.ts";
import { leonardoProvider } from "./registry/leonardo/index.ts";
import { kieProvider } from "./registry/kie/index.ts";
import { monsterapiProvider } from "./registry/monsterapi/index.ts";
import { modelscopeProvider } from "./registry/modelscope/index.ts";
import { sensenovaProvider } from "./registry/sensenova/index.ts";
import { hyperbolicProvider } from "./registry/hyperbolic/index.ts";
import { lambda_aiProvider } from "./registry/lambda-ai/index.ts";
import { iflytekProvider } from "./registry/iflytek/index.ts";
import { crofProvider } from "./registry/crof/index.ts";
import { moonshotProvider } from "./registry/moonshot/index.ts";
import { poeProvider } from "./registry/poe/index.ts";
import { bazaarlinkProvider } from "./registry/bazaarlink/index.ts";
import { perplexityProvider } from "./registry/perplexity/index.ts";
import { minimaxProvider } from "./registry/minimax/index.ts";
import { minimax_cnProvider } from "./registry/minimax/cn/index.ts";
import { haiperProvider } from "./registry/haiper/index.ts";
import { bytezProvider } from "./registry/bytez/index.ts";
import { blackboxProvider } from "./registry/blackbox/index.ts";
import { uncloseaiProvider } from "./registry/uncloseai/index.ts";
import { nscaleProvider } from "./registry/nscale/index.ts";
import { openrouterProvider } from "./registry/openrouter/index.ts";
import { cheaperinferenceProvider } from "./registry/cheaperinference/index.ts";
import { openvectaProvider } from "./registry/openvecta/index.ts";
import { orcarouterProvider } from "./registry/orcarouter/index.ts";
import { stepfunProvider } from "./registry/stepfun/index.ts";
import { freemodel_devProvider } from "./registry/freemodel-dev/index.ts";
import { gitlawb_gmiProvider } from "./registry/gitlawb/gmi/index.ts";
import { gitlawbProvider } from "./registry/gitlawb/index.ts";
import { liquidProvider } from "./registry/liquid/index.ts";
import { deepinfraProvider } from "./registry/deepinfra/index.ts";
import { agyProvider } from "./registry/agy/index.ts";
import { agnesProvider } from "./registry/agnes/index.ts";
import { aihordeProvider } from "./registry/aihorde/index.ts";
import { ainativeProvider } from "./registry/ainative/index.ts";
import { aionProvider } from "./registry/aion/index.ts";
import { longcatProvider } from "./registry/longcat/index.ts";
import { vertex_partnerProvider } from "./registry/vertex/partner/index.ts";
import { vertexProvider } from "./registry/vertex/index.ts";
import { xaiProvider } from "./registry/xai/index.ts";
import { xai_oauthProvider } from "./registry/xai-oauth/index.ts";
import { morphProvider } from "./registry/morph/index.ts";
import { siliconflowProvider } from "./registry/siliconflow/index.ts";
import { gitlab_duoProvider } from "./registry/gitlab-duo/index.ts";
import { command_codeProvider } from "./registry/command-code/index.ts";
import { novitaProvider } from "./registry/novita/index.ts";
import { regoloProvider } from "./registry/regolo/index.ts";
import { windsurfProvider } from "./registry/windsurf/index.ts";
import { zed_hostedProvider } from "./registry/zed-hosted/index.ts";
import { nanogptProvider } from "./registry/nanogpt/index.ts";
import { scalewayProvider } from "./registry/scaleway/index.ts";
import { agentrouterProvider } from "./registry/agentrouter/index.ts";
import { zaiProvider } from "./registry/zai/index.ts";
import { waferProvider } from "./registry/wafer/index.ts";
import { galadrielProvider } from "./registry/galadriel/index.ts";
import { qianfanProvider } from "./registry/qianfan/index.ts";
import { meta_llamaProvider } from "./registry/meta-llama/index.ts";
import { cloudflare_aiProvider } from "./registry/cloudflare-ai/index.ts";
import { nous_researchProvider } from "./registry/nous-research/index.ts";
import { alibabaProvider } from "./registry/alibaba/index.ts";
import { alibaba_cnProvider } from "./registry/alibaba/cn/index.ts";
import { doubaoProvider } from "./registry/doubao/index.ts";
import { kilo_gatewayProvider } from "./registry/kilo-gateway/index.ts";
import { bailian_coding_planProvider } from "./registry/bailian-coding-plan/index.ts";
import { gigachatProvider } from "./registry/gigachat/index.ts";
import { devin_cliProvider } from "./registry/devin-cli/index.ts";
import { devin_cli_agenticProvider } from "./registry/devin-cli-agentic/index.ts";
import { auggieProvider } from "./registry/auggie/index.ts";
import { chutesProvider } from "./registry/chutes/index.ts";
import { chenzkProvider } from "./registry/chenzk/index.ts";
import { factoryProvider } from "./registry/factory/index.ts";
import { databricksProvider } from "./registry/databricks/index.ts";
import { rekaProvider } from "./registry/reka/index.ts";
import { typhoonProvider } from "./registry/typhoon/index.ts";
import { inceptionProvider } from "./registry/inception/index.ts";
import { sarvamProvider } from "./registry/sarvam/index.ts";
import { writerProvider } from "./registry/writer/index.ts";
import { plamoProvider } from "./registry/plamo/index.ts";
import { internlmProvider } from "./registry/internlm/index.ts";
import { ant_lingProvider } from "./registry/ant-ling/index.ts";
import { vercel_ai_gatewayProvider } from "./registry/vercel-ai-gateway/index.ts";
import { v0_vercelProvider } from "./registry/v0-vercel/index.ts";
import { opencode_zenProvider } from "./registry/opencode/zen/index.ts";
import { opencode_goProvider } from "./registry/opencode/go/index.ts";
import { opencodeProvider } from "./registry/opencode/index.ts";
import { dahlProvider } from "./registry/dahl/index.ts";
import { maritalkProvider } from "./registry/maritalk/index.ts";
import { basetenProvider } from "./registry/baseten/index.ts";
import { geminiProvider } from "./registry/gemini/index.ts";
import { clineProvider } from "./registry/cline/index.ts";
import { herokuProvider } from "./registry/heroku/index.ts";
import { bluesmindsProvider } from "./registry/bluesminds/index.ts";
import { baiduProvider } from "./registry/baidu/index.ts";
import { pollinationsProvider } from "./registry/pollinations/index.ts";
import { codexProvider } from "./registry/codex/index.ts";
import { veniceProvider } from "./registry/venice/index.ts";
import { kiroProvider } from "./registry/kiro/index.ts";
import { openadapterProvider } from "./registry/openadapter/index.ts";
import { ditProvider } from "./registry/dit/index.ts";
import { tokenrouterProvider } from "./registry/tokenrouter/index.ts";
import { grok_cliProvider } from "./registry/grok-cli/index.ts";
import { codebuddy_cnProvider } from "./registry/codebuddy-cn/index.ts";
import { pioneerProvider } from "./registry/pioneer/index.ts";
import { sumopodProvider } from "./registry/sumopod/index.ts";
import { x5labProvider } from "./registry/x5lab/index.ts";
import { kenariProvider } from "./registry/kenari/index.ts";
import { navyProvider } from "./registry/navy/index.ts";
import { naraProvider } from "./registry/nara/index.ts";
import { requestyProvider } from "./registry/requesty/index.ts";
import { sealionProvider } from "./registry/sealion/index.ts";
import { routewayProvider } from "./registry/routeway/index.ts";
import { digitaloceanProvider } from "./registry/digitalocean/index.ts";
import { hcnsecProvider } from "./registry/hcnsec/index.ts";

import { clova_studioProvider } from "./registry/clova-studio/index.ts";

export const REGISTRY: Record<string, RegistryEntry> = {
  aimlapi: aimlapiProvider,
  "ollama-cloud": ollama_cloudProvider,
  synthetic: syntheticProvider,
  ideogram: ideogramProvider,
  friendliai: friendliaiProvider,
  anthropic: anthropicProvider,
  sambanova: sambanovaProvider,
  puter: puterProvider,
  upstage: upstageProvider,
  nebius: nebiusProvider,
  fireworks: fireworksProvider,
  llamagate: llamagateProvider,
  glm: glmProvider,
  glmt: glmtProvider,
  "glm-cn": glm_cnProvider,
  trae: traeProvider,
  raycast: raycastProvider,
  kilocode: kilocodeProvider,
  "github-models": github_modelsProvider,
  github: githubProvider,
  "ghe-copilot": gheCopilotProvider,
  dify: difyProvider,
  ovhcloud: ovhcloudProvider,
  claude: claudeProvider,
  bedrock: bedrockProvider,
  "xiaomi-mimo": xiaomi_mimoProvider,
  "xiaomi-mimo-token-plan": xiaomi_mimo_token_planProvider,
  codestral: codestralProvider,
  wandb: wandbProvider,
  predibase: predibaseProvider,
  baichuan: baichuanProvider,
  yi: yiProvider,
  deepseek: deepseekProvider,
  dgrid: dgridProvider,
  bai: baiProvider,
  qiniu: qiniuProvider,
  "kimi-coding-apikey": kimi_coding_apikeyProvider,
  "kimi-coding": kimi_codingProvider,
  kimi: kimiProvider,
  groq: groqProvider,
  "inference-net": inference_netProvider,
  llm7: llm7Provider,
  cerebras: cerebrasProvider,
  "charm-hyper": charmHyperProvider,
  nube: nubeProvider,
  clinepass: clinepassProvider,
  sparkdesk: sparkdeskProvider,
  nlpcloud: nlpcloudProvider,
  nvidia: nvidiaProvider,
  "api-airforce": api_airforceProvider,
  mistral: mistralProvider,
  together: togetherProvider,
  cohere: cohereProvider,
  cursor: cursorProvider,
  "cursor-oauth": cursorOAuthProvider,
  volcengine: volcengineProvider,
  hackclub: hackclubProvider,
  freetheai: freetheaiProvider,
  "g4f-groq": g4f_groqProvider,
  "g4f-gemini": g4f_geminiProvider,
  "g4f-pollinations": g4f_pollinationsProvider,
  "g4f-ollama": g4f_ollamaProvider,
  "g4f-nvidia": g4f_nvidiaProvider,
  tencent: tencentProvider,
  coze: cozeProvider,
  ai21: ai21Provider,
  publicai: publicaiProvider,
  "featherless-ai": featherless_aiProvider,
  antigravity: antigravityProvider,
  openai: openaiProvider,
  snowflake: snowflakeProvider,
  huggingface: huggingfaceProvider,
  freeaiapikey: freeaiapikeyProvider,
  "qwen-cloud": qwen_cloudProvider,
  "qwen-cloud-token-plan": qwen_cloud_token_planProvider,
  modal: modalProvider,
  zenmux: zenmuxProvider,
  leonardo: leonardoProvider,
  kie: kieProvider,
  monsterapi: monsterapiProvider,
  modelscope: modelscopeProvider,
  sensenova: sensenovaProvider,
  hyperbolic: hyperbolicProvider,
  "lambda-ai": lambda_aiProvider,
  iflytek: iflytekProvider,
  crof: crofProvider,
  moonshot: moonshotProvider,
  poe: poeProvider,
  bazaarlink: bazaarlinkProvider,
  perplexity: perplexityProvider,
  minimax: minimaxProvider,
  "minimax-cn": minimax_cnProvider,
  haiper: haiperProvider,
  bytez: bytezProvider,
  blackbox: blackboxProvider,
  uncloseai: uncloseaiProvider,
  nscale: nscaleProvider,
  openrouter: openrouterProvider,
  cheaperinference: cheaperinferenceProvider,
  openvecta: openvectaProvider,
  orcarouter: orcarouterProvider,
  stepfun: stepfunProvider,
  "freemodel-dev": freemodel_devProvider,
  "gitlawb-gmi": gitlawb_gmiProvider,
  gitlawb: gitlawbProvider,
  liquid: liquidProvider,
  deepinfra: deepinfraProvider,
  agy: agyProvider,
  agnes: agnesProvider,
  aihorde: aihordeProvider,
  ainative: ainativeProvider,
  aion: aionProvider,
  longcat: longcatProvider,
  "vertex-partner": vertex_partnerProvider,
  vertex: vertexProvider,
  xai: xaiProvider,
  "xai-oauth": xai_oauthProvider,
  morph: morphProvider,
  siliconflow: siliconflowProvider,
  "gitlab-duo": gitlab_duoProvider,
  "command-code": command_codeProvider,
  novita: novitaProvider,
  regolo: regoloProvider,
  windsurf: windsurfProvider,
  "zed-hosted": zed_hostedProvider,
  nanogpt: nanogptProvider,
  scaleway: scalewayProvider,
  agentrouter: agentrouterProvider,
  zai: zaiProvider,
  galadriel: galadrielProvider,
  qianfan: qianfanProvider,
  "meta-llama": meta_llamaProvider,
  "cloudflare-ai": cloudflare_aiProvider,
  "nous-research": nous_researchProvider,
  alibaba: alibabaProvider,
  "alibaba-cn": alibaba_cnProvider,
  doubao: doubaoProvider,
  "kilo-gateway": kilo_gatewayProvider,
  "bailian-coding-plan": bailian_coding_planProvider,
  gigachat: gigachatProvider,
  "devin-cli": devin_cliProvider,
  "devin-cli-agentic": devin_cli_agenticProvider,
  auggie: auggieProvider,
  chutes: chutesProvider,
  chenzk: chenzkProvider,
  factory: factoryProvider,
  databricks: databricksProvider,
  reka: rekaProvider,
  typhoon: typhoonProvider,
  inception: inceptionProvider,
  sarvam: sarvamProvider,
  writer: writerProvider,
  plamo: plamoProvider,
  "clova-studio": clova_studioProvider,
  internlm: internlmProvider,
  "ant-ling": ant_lingProvider,
  "vercel-ai-gateway": vercel_ai_gatewayProvider,
  "v0-vercel": v0_vercelProvider,
  "opencode-zen": opencode_zenProvider,
  "opencode-go": opencode_goProvider,
  opencode: opencodeProvider,
  dahl: dahlProvider,
  maritalk: maritalkProvider,
  baseten: basetenProvider,
  gemini: geminiProvider,
  cline: clineProvider,
  heroku: herokuProvider,
  bluesminds: bluesmindsProvider,
  baidu: baiduProvider,
  pollinations: pollinationsProvider,
  codex: codexProvider,
  venice: veniceProvider,
  kiro: kiroProvider,
  byteplus: byteplusProvider,
  wafer: waferProvider,
  openadapter: openadapterProvider,
  dit: ditProvider,
  tokenrouter: tokenrouterProvider,
  "grok-cli": grok_cliProvider,
  "codebuddy-cn": codebuddy_cnProvider,
  pioneer: pioneerProvider,
  sumopod: sumopodProvider,
  x5lab: x5labProvider,
  kenari: kenariProvider,
  navy: navyProvider,
  nara: naraProvider,
  requesty: requestyProvider,
  sealion: sealionProvider,
  routeway: routewayProvider,
  digitalocean: digitaloceanProvider,
  hcnsec: hcnsecProvider,
  unorouter: unorouterProvider,
};
