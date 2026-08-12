# OmniRoute Tiny

OmniRoute Tiny 是一个独立维护的、面向自托管场景的 LLM 聚合网关。

本项目最初基于 [OmniRoute](https://github.com/diegosouzapw/OmniRoute) `v3.8.50`
建立，现已选择独立演进：不再以持续合并上游为目标，也不是 OmniRoute 官方发行版。
后续如需新的 Provider、协议兼容或安全修复，将在审阅完整变更后选择性移植。

> Independent project notice: OmniRoute Tiny is an independent project derived from
> OmniRoute v3.8.50. It is not an official OmniRoute distribution and does not promise
> ongoing synchronization with the upstream repository.

## 项目方向

OmniRoute Tiny 专注于一件事：把多个 Provider、账号和订阅连接聚合为一个稳定、可观测的
LLM 网关。项目会逐步减少与网关无关的 Agent 平台模块、构建依赖、测试范围和代码量。

当前阶段采用可验证的 Gateway 构建配置，尚未从源码树中一次性删除所有上游模块。这样可以先
保证现有客户端、数据和 Provider 连接可用，再按模块逐步收缩。

当前继承基线在代码中注册了 291 个 Provider；这个数量会随着独立项目后续的保留、移植和删除
而变化，不承诺与上游目录长期一致。

### Gateway 构建保留

- Provider、OAuth 和 API Key 连接
- OpenAI Chat Completions 与 Responses API 入口
- Anthropic、Gemini 等客户端兼容入口
- 流式输出、工具调用和 reasoning
- 模型发现、账号池、额度、健康状态、冷却和熔断
- Combo 路由、重试与故障转移
- 账号、模型、聚合组、日志和设置等核心 Dashboard
- 现有 SQLite 数据结构与持久化目录

### Gateway 产物排除

- MCP Server
- Skills、Memory 与 Agent Skills
- A2A、ACP、Cloud Agent 和插件系统
- Prompt Compression 及其 LLMLingua、TensorFlow、Transformers、tiktoken 依赖
- Evals、Chaos、Gamification、Local Corpus 等 Agent 平台功能
- 与上述功能对应的 API、Dashboard 页面和后台启动任务

这里的“排除”是指 Gateway 构建产物。部分源码目前仍保留在仓库中，后续会在核心网关契约测试
覆盖后逐步删除。

## 构建

安装依赖后构建 Gateway Edition：

```bash
npm ci
npm run build:gateway
npm run check:gateway-artifact -- .build/next/standalone
```

本地构建带 Dashboard 的完整镜像：

```bash
docker build \
  --target runner-web \
  -t achanyao/omniroute-tiny:nightly .
```

CI 只发布这一套带 Web UI 的主镜像；Docker Hub 仓库由 GitHub Repository Variable
`DOCKERHUB_IMAGE=achanyao/omniroute-tiny` 配置，GHCR 对应
`ghcr.io/achanyao/omniroute-tiny`。Tag 规则：

- 稳定 Release `vX.Y.Z` → `:X.Y.Z`，且最高稳定版本同步更新 `:latest`；
- 可复现验证构建 → `:X.Y.Z-alpha.N`，不更新 `:latest`；
- 可覆盖的临时验证构建 → `:nightly`，不更新 `:latest`；
- 所有 CI 发布 Tag 均为 `linux/amd64` + `linux/arm64` multi-arch manifest；
- 不再发布无 Web UI 的基础镜像，也不再使用 `-web` / `latest-web` 后缀。

数据仍应挂载到 `/app/data`。部署和回滚时优先使用明确的版本或 alpha Tag；`nightly` 仅用于验证。

## 当前兼容策略

Gateway 构建暂时保留 OmniRoute 原有的协议转换能力，因此现有客户端可以继续使用
`/v1/chat/completions`、`/v1/responses` 及其他兼容入口。

项目后续计划在不破坏当前能力的前提下引入：

1. Provider + 连接 + 模型级协议能力标记；
2. Chat Completions 与 Responses 的原生协议优先路由；
3. 相同原始模型 ID 跨 Provider 的自动聚合；
4. `/v1/models` 默认只展示聚合后的逻辑模型 ID；
5. 可选的严格协议保持模式，避免隐式跨协议转换。

以上为路线方向，不代表当前版本已经全部实现。

## 与上游的关系

- 本项目不再维护可无冲突合并回上游的长期分支；
- 不定期检查上游的 Provider、协议兼容和安全修复；
- 需要的变更会按完整补丁选择性移植，而不是自动合并上游版本；
- 不移植与纯聚合网关目标无关的平台功能；
- 保留原项目版权、许可证和贡献者归属。

## 状态与风险

OmniRoute Tiny 当前面向个人及小规模自托管使用。Gateway 构建已经过针对性单元测试、Docker
构建和本地容器验证，但尚未完成独立项目所需的全部依赖拆分和轻量化测试矩阵。升级前请备份
`/app/data`，并使用明确的镜像标签保留回滚路径。

## License

本项目继续遵循仓库中的 [MIT License](LICENSE)。原始 OmniRoute 项目的版权、许可证和贡献历史
继续保留；本项目的独立修改不代表原项目维护者背书。
