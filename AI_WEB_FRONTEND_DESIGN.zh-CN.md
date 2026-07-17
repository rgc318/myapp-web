# AI Web 前端企业级设计

更新时间：2026-07-16

本文是 `myapp-web` AI 模块的前端设计事实来源，集中记录信息架构、组件选型、状态与数据流、权限边界、异常恢复、测试门禁和后续演进。后端业务安全、数据模型和完整 API 契约仍分别以 `apps/myapp/AI_TECH_DESIGN.zh-CN.md` 与 `apps/myapp/API_GATEWAY.zh-CN.md` 为准。

## 1. 设计状态

当前设计已完成本轮实现：

- `/ai` 已迁移到 Ant Design Pro、Ant Design X 和 Ant Design X Markdown 官方组件体系。
- `/ai/drafts` 已提供当前用户的销售订单、采购订单和库存调整草稿中心。
- AI 管理功能已拆分为模型、策略、用量、向量、审计和数据治理深链路页面。
- Web 与 Frappe Gateway 的会话、Run、反馈、草稿、治理、向量和审计契约已对齐。
- 生产依赖审计使用精确 `overrides` 处理 `lodash`、`lodash-es`、`path-to-regexp 8.x` 和 `yaml 1.x` 的已知问题，`npm audit --omit=dev` 为 0。

本轮实现不代表正式生产部署已经完成。角色验收、浏览器端端到端回归、真实 staging、SSO、TLS、Secret Manager、HA 和告警平台仍按部署计划验收。

## 2. 目标与非目标

### 2.1 目标

- 为业务人员提供可追溯、可停止、可恢复的 AI Copilot 工作台。
- 将商品查询、订单查询、经营报表解释和结构化业务草稿统一到同一会话体验中。
- 将模型、策略、预算、用量、向量、审计和数据任务治理形成可深链、可授权的管理工作区。
- 保持桌面管理系统的信息密度、可扫描性和操作效率。
- 确保页面只消费领域 Service 返回的稳定对象，不解析 Frappe 包络或后端蛇形字段。
- 确保权限、状态机、职责分离、正式业务写入和审计始终由后端裁决。

### 2.2 非目标

- Web 不直连 AI Orchestrator、LiteLLM、Langfuse、Qdrant 或模型供应商。
- Web 不保存供应商 Key、LiteLLM 管理密钥或 Orchestrator Service Token。
- AI 不直接创建、提交、取消正式单据，不执行收付款，不直接修改库存。
- 页面不从自然语言或 Markdown 中猜测订单、商品、金额、库存或权限事实。
- 前端权限点不替代后端角色、公司范围、记录级权限和职责分离校验。
- 当前不引入第三方后台模板、第二套设计系统或页面级全局状态框架。

## 3. 架构边界

```text
Browser / myapp-web
  ├─ Ant Design Pro / ProComponents / Ant Design X
  ├─ src/pages/AI/*
  ├─ src/pages/Administration/AI*
  └─ src/services/myapp/ai*.ts
                 │ JWT Bearer + Frappe Gateway contract
                 ▼
Frappe / apps/myapp
  ├─ 用户、角色、公司和记录权限
  ├─ 会话、Run、反馈、草稿、版本和审计
  ├─ 治理状态机与正式业务校验
  └─ 受控调用 AI Orchestrator
                 │ internal service token
                 ▼
AI Orchestrator → LiteLLM / Qdrant / Langfuse
```

不可变规则：

1. 浏览器请求只能到 Frappe Gateway。
2. Frappe 是权限、正式业务数据和写入行为的事实源。
3. Orchestrator 负责模型编排，不接管 ERP 权限和正式单据状态机。
4. LiteLLM、Qdrant 和 Langfuse 对浏览器不可见。
5. 页面只展示后端返回的业务事实和允许操作，不自行提升权限或推导关键状态。

## 4. 信息架构与路由

| 路由 | 用户目标 | 主要结构 | 路由权限 |
| --- | --- | --- | --- |
| `/ai` | 对话、查询、解释、生成业务草稿 | 会话侧栏、消息区、浮动输入区、Run 详情 Drawer | `canUseAI` |
| `/ai/drafts` | 集中处理当前用户草稿 | 筛选、草稿卡片、校验、来源会话、交接 | `canUseAI` |
| `/administration/ai/models` | 模型注册和运行概览 | KPI、模型表、详情抽屉、治理操作 | `canViewAiGovernance` |
| `/administration/ai/policies` | 策略起草、验证、审批、发布与回滚 | 策略表、版本历史、表单和确认操作 | `canViewAiGovernance` |
| `/administration/ai/usage` | 请求、成功率、Token、成本和延迟分析 | 30 日 KPI、趋势图和明细 | `canViewAiGovernance` |
| `/administration/ai/vectors` | 在线索引和 Embedding 发布治理 | 索引状态、失败项、补建、清理、发布版本 | `canViewAiGovernance` |
| `/administration/ai/audit` | 查询治理和高风险操作证据 | 服务端分页、组合筛选、审计表 | `canViewAiGovernance` |
| `/administration/ai/data-tasks` | 商品数据治理任务 | ProTable、详情抽屉、审批、执行和回滚 | `canViewAiDataGovernance` |

治理页面使用独立 URL，而不是只依赖单页 Tab 状态，原因是：

- 支持收藏、刷新和从告警或审计记录直接进入目标工作区。
- 路由级权限和菜单可见性更清晰。
- 页面职责、数据请求和后续按模块拆包更容易演进。

## 5. UI 与组件规范

### 5.1 技术选型

- 布局与企业页面：Ant Design Pro、ProComponents。
- AI 对话：`@ant-design/x`。
- AI Markdown：`@ant-design/x-markdown`。
- 图表：`@ant-design/plots`。
- 局部样式：`antd-style`，优先使用 Ant Design token。
- 列表与治理操作：`ProTable`、`ProCard`、`StatisticCard`、`Tabs`、`Drawer`、`Modal`、`Form`。

不使用第三方聊天模板或后台主题。官方示例只用于组件结构参考，不能复制外部 Provider 直连、客户端密钥或 mock 业务契约。

### 5.2 AI 工作台布局

桌面端默认采用双栏结构：

- 左栏：活跃/归档会话、新建会话和草稿中心入口。
- 主区：品牌栏、场景与公司上下文、消息列表、Welcome/Prompts 空态和浮动 Sender 输入区。
- Run 详情不常驻占用对话宽度，通过右侧 Drawer 展示状态、模型、后端总耗时、首 Token、流式分块、Token 分解、Run、trace、工具进度、警告和失败恢复操作。

响应式规则：

- 大屏展示会话侧栏和居中的主消息区。
- Run 详情在所有桌面宽度都通过 Drawer 按需打开，不挤压消息正文。
- 小于 MD 时会话侧栏进入左侧 Drawer，避免压缩消息正文和输入区，同时保留历史会话入口。
- 工作区使用视口高度和最小高度约束，消息区独立滚动，Sender 固定在工作区底部。

### 5.3 消息呈现

- `Bubble.List` 只负责用户与助手消息结构。
- `XMarkdown` 渲染解释性文本，并在流式阶段显示未完成状态。
- 首段文本到达前，助手占位必须显示当前运行阶段和客户端等待计时；不得只显示空白气泡或让用户误以为请求未发出。
- `Sources` 展示结构化业务来源入口。
- 商品、订单、经营报表和 AI 草稿使用独立 citation 卡片展示业务字段。
- `Actions` 提供有帮助/无帮助反馈，不把反馈按钮混入正文。
- 业务数值、单据状态和草稿校验来自 citation 数据，不从 Markdown 再解析。

## 6. 前端分层与代码组织

```text
src/pages/AI/
  index.tsx                    AI 工作台和会话编排
  styles.ts                    token 化布局样式
  components/AiMessageContent.tsx
  Drafts/index.tsx             当前用户草稿中心

src/pages/Administration/
  AIModels/                    模型治理总览和共享治理容器
  AIPolicies/                  策略深链入口
  AIUsage/                     用量深链入口
  AIVectors/                   向量深链入口
  AIAudit/                     审计中心
  AIDataTasks/                 数据任务治理

src/services/myapp/
  ai.ts                        会话、SSE、反馈和草稿领域 Service
  ai-governance.ts             模型、策略、用量、向量、审计和任务 Service
  mutation.ts                  幂等写请求
  api-client.ts                包络、认证续期和错误处理
```

分层约束：

- 页面调用领域 Service，不直接调用通用 request 拼接 AI Gateway 方法。
- `ai.ts` 和 `ai-governance.ts` 负责 snake_case → camelCase、分页和可选字段归一化。
- 页面不得读取 Frappe `message` 外层包络，也不得重复实现错误解析。
- 治理写操作使用 `runGatewayMutation` 生成幂等键。
- 页面可以组合展示数据，但不能复制后端状态机和职责分离规则。

## 7. 会话、流式响应与恢复

### 7.1 会话生命周期

```text
新工作区
  └─ 首次发送 → 后端创建会话 → 返回 conversationId
活跃会话
  ├─ 继续发送
  ├─ 查看历史 Run/反馈
  └─ 归档
归档会话
  └─ 只读；继续提问必须新建会话
```

- 会话列表按 `active` / `archived` 查询，页面不把归档仅作为本地标记。
- 打开历史会话时重新加载消息、citation、Run 摘要和已提交反馈。
- URL 可携带 `conversation` 参数，用于从草稿或其他业务入口回到来源会话。
- 页面刷新后不依赖内存中的 `lastResult` 恢复模型、Token、trace 和反馈状态。
- 已有会话始终使用后端返回的会话公司；用户后续修改工作偏好不会改变当前会话公司。新建会话才读取当前默认公司，界面需明确区分“会话公司”和“默认公司”。

### 7.2 SSE 事件处理

普通对话、商品查询、订单查询和经营报表解释通过 POST + JWT SSE：

1. 创建用户消息和空助手消息占位。
2. `run_started` 绑定 `conversationId` 和 `runId`。
3. `run_progress` 更新上下文准备、工具、模型首段等待和流式输出阶段；页面从请求开始持续显示已等待时间。
4. `message_delta` 追加助手文本，首段到达后继续逐块渲染。
5. `citation` 增量追加结构化来源。
6. `warning` 追加非阻断警告。
7. `completed` 返回最终内容、Run、用量和 `stream.delta_count / streamed_chars`。
8. `error` 转换为用户可理解的错误提示。

浏览器使用 `fetch + ReadableStream`，不使用原生 `EventSource`，因为请求需要 POST body 和 JWT Bearer Header。

销售、采购和库存调整草稿使用严格结构化模型结果，并在 Frappe 侧重新做权限、主数据、UOM、价格或库存校验，因此不能把未闭合 JSON 当作业务草稿逐字展示。页面在等待期间显示“结构化生成与后端校验”阶段，只有最终验证通过或带明确校验错误的草稿才整体呈现。

### 7.3 停止与失败策略

- `Sender` 停止按钮通过 `AbortController` 中断浏览器读取。
- 用户停止后保留已经接收的内容。
- 停止后不自动重试，避免重复模型费用、重复 Run 或重复工具调用。
- 停止或失败后保留明确状态和错误信息，只在用户主动点击时重新发送上次问题。
- 普通失败会移除空助手占位，并保留用户问题供人工重试。
- 已归档会话禁止发送，页面在请求前给出明确提示。
- 需要公司上下文的新会话在发送前检查工作偏好；已有会话使用持久会话公司，后端仍再次校验公司权限并拒绝显式跨公司混用。

## 8. 业务场景与结构化来源

当前 `AiScenario` 覆盖：

- 通用助手。
- 商品描述和语义查询。
- 销售/采购订单查询。
- 经营报表解释。
- 销售订单草稿。
- 采购订单草稿。
- 库存调整草稿。

结构化 citation 的设计目的：

- 把模型解释与 ERP 事实分离。
- 支持可点击的业务详情入口。
- 保留商品匹配原因、语义相关度、库存、单位和参考价。
- 保留订单日期、往来单位、金额、未结金额和状态。
- 保留经营指标的确定性键值。
- 保留草稿 ID、类型、版本、状态、校验错误和允许操作。

任何新增 citation 类型都必须先扩展领域 Service 类型和映射，再新增展示组件；不得在页面中解析任意 JSON 后直接渲染关键业务动作。

## 9. 草稿工作流

### 9.1 安全边界

AI 草稿是可审计的预填建议，不是正式单据。模型只负责结构化候选提取，Frappe 负责：

- 当前用户和公司权限。
- Customer、Supplier、Item、Warehouse 和 UOM 解析。
- 单位换算、参考价格和实时库存校验。
- 草稿版本、状态、来源 Run 和人工修改审计。
- 是否允许进入业务编辑器。

### 9.2 前端流程

```text
自然语言
  → 生成结构化草稿
  → citation 草稿卡片
  → 人工编辑
  → 后端重新解析和校验
  → 查看不可变版本历史
  → ready_for_handoff
  → 一次性交接载荷
  → 既有销售/采购/库存编辑器
  → 用户复核并主动保存
```

- 草稿状态由后端返回，前端不自行认定可交接。
- 人工修改后必须调用后端更新接口重新校验。
- 历史恢复不会覆盖当前版本，而是由后端创建新版本。
- 放弃草稿后禁用编辑和交接。
- 交接通过一次性 `sessionStorage` 载荷复用既有业务编辑器；正式保存仍走原业务接口。
- `/ai/drafts` 只列出当前登录用户拥有的草稿，后端 owner 隔离是最终边界。
- 草稿中心详情优先展示公司、往来单位、日期、仓库、业务明细、单位、参考价或库存变化和校验结果；原始 JSON 只作为辅助诊断页签。
- 草稿中心可查看不可变版本差异，并通过后端恢复接口把历史快照重新校验为新版本；不得在浏览器直接覆盖当前 payload。

## 10. 治理工作区设计

### 10.1 模型与运行概览

- 展示 Orchestrator 可达性、当前模型、Embedding、向量和 Langfuse 配置状态。
- 展示近 7 日请求、成功、错误、Token、成本和 p95。
- 模型表展示能力、健康、数据区域、留存、成本和敏感数据策略。
- 修改治理元数据需要后端权限、原因和审计。

### 10.2 策略治理

- 策略包含场景、能力、模型、降级链、角色/公司范围、超时、并发、限流、预算和灰度。
- 页面展示不可变版本历史、验证结果、发布版本和回滚目标。
- 起草、验证、审批、发布和回滚均调用独立后端动作。
- 发布权限不根据按钮是否可见推断，后端继续执行双人审批和生产发布约束。

### 10.3 用量与成本

- 默认提供近 30 日 KPI 与趋势。
- 可按日期、环境和公司查询。
- 同时展示请求量、成功率、Token、估算成本、首 Token p95 和总延迟 p95。
- 图表数据来自日聚合接口，不在浏览器扫描原始 Run 计算生产指标。

### 10.4 向量与 Embedding

- 在线索引区展示总量、待处理、失败、排除项和最近失败。
- 重建支持待处理、仅失败和明确商品范围。
- 排除向量清理必须先 dry-run，再填写原因执行；结果需证明 ERP Item 未修改。
- Embedding release 保持候选构建、验证、审批、发布和回滚状态机。
- 页面不直接操作 Qdrant collection 或 alias。

### 10.5 审计中心

- 使用服务端分页，不加载固定数量后在浏览器过滤。
- 支持关键词、动作、对象类型、优先级和日期范围组合筛选。
- 审计记录只展示后端允许暴露的摘要，不展示供应商密钥或内部 Token。

### 10.6 Data Task

- 首期只覆盖 Item 的商品名称、描述、品牌和商品组。
- 支持缺失描述扫描、手工建议、前值/建议值/证据对比、审批/驳回、执行和回滚。
- 页面优先使用后端 `actions.<action>.allowed/reason` 控制按钮和解释禁用原因。
- 页面不能绕过任务状态机直接调用商品更新接口。

## 11. 权限模型

| 角色 | Web 能力摘要 |
| --- | --- |
| 已登录用户 | 使用 AI 助手和管理自己的会话、反馈及草稿 |
| AI Model Manager | 查看模型治理，维护模型元数据和策略草稿 |
| AI Model Approver | 查看并审批模型策略 |
| AI Auditor | 只读查看治理和审计 |
| AI Data Steward | 扫描、创建和执行允许的数据任务 |
| AI Data Approver | 审批或驳回数据任务 |
| System Manager | 管理、发布和回滚等系统级能力 |

`src/access.ts` 只负责路由、菜单和按钮体验。所有动作都必须预期后端可能拒绝，并展示后端返回的原因。

## 12. 状态、异常与恢复

页面至少区分：

- 首次加载、局部刷新和写操作 loading。
- 空会话、无草稿、无用量、无审计和无失败向量。
- 权限不足、状态不允许、输入校验失败和后端业务拒绝。
- Gateway 不可用、Orchestrator 不可达、模型失败和流式中断。
- 写操作成功但观测同步失败等非阻断警告。

恢复原则：

- 可重试的查询保留筛选条件。
- 写操作依赖幂等键，不在页面自动重复提交。
- Run、反馈、草稿和版本以持久化数据恢复，不依赖浏览器内存。
- 向量清理、策略发布、任务执行和回滚必须有确认、原因和后端审计。

## 13. 安全与隐私

- 认证统一使用项目 JWT Bearer 机制。
- 不在 URL、localStorage、日志或页面状态中保存模型供应商密钥。
- 不渲染后端未清洗的任意 HTML；模型正文通过 Markdown 组件处理。
- citation 链接必须由受控类型映射生成，不能使用模型自由文本作为管理端 URL。
- 反馈绑定当前用户自己的已完成 Run。
- 会话、草稿、Run 和反馈均由后端实施 owner 隔离。
- 管理写操作需要权限、状态、原因、幂等和审计。
- 生产依赖审计以 `npm audit --omit=dev` 为发布口径；完整开发工具链告警单独治理，不能与浏览器生产依赖混为一谈。

## 14. 性能与可维护性

当前约束：

- 路由页面由 Umi 按页面生成异步 chunk。
- 对话消息区独立滚动，避免整页重排。
- 用量、审计、模型、策略和任务列表使用后端分页或聚合。
- 结构化 citation 与 Markdown 分离，避免反复解析大段模型文本。
- 停止生成直接取消当前读取，不启动额外轮询。

后续优化优先级：

1. 对超长会话增加窗口化渲染或分页加载。
2. 对 AI 相关大依赖继续分析 chunk，并评估按能力延迟加载。
3. 为高频治理查询增加可控缓存和刷新策略。
4. 建立浏览器性能预算，持续观察首屏、交互和长会话内存。

## 15. 测试与验收门禁

提交前至少执行：

```bash
npm run tsc
npm run biome:lint
npm test -- --runInBand
npm run build
npm audit --omit=dev
git diff --check
```

自动化覆盖重点：

- AI Service 的包络、字段映射、会话、Run、反馈、草稿和版本。
- Governance Service 的模型、策略、用量、向量、审计和 Data Task 映射。
- 页面所依赖的权限点和业务 Service 契约。
- AI 工作台流式交互、运行诊断、显式失败重试，以及草稿业务复核和版本差异组件。

人工验收重点：

- 普通用户只能查看自己的会话、反馈和草稿。
- 归档会话只读，停止生成保留已接收内容。
- 三类草稿必须经过后端校验并进入既有编辑器复核。
- Model Manager、Approver、Auditor、Data Steward、Data Approver 和 System Manager 的菜单及操作与后端一致。
- 策略发布、向量清理、任务执行和回滚的禁用原因、确认内容与审计记录一致。
- Orchestrator 或观测系统故障时页面能区分主链路失败和非阻断降级。

## 16. 设计决策记录

1. 选择 Ant Design X，而不是引入社区聊天模板：与现有 Ant Design Pro 技术栈、主题 token 和企业组件一致。
2. 使用 POST + JWT SSE，而不是 EventSource：需要请求体、认证 Header 和受控场景上下文。
3. 使用结构化 citation，而不是解析 Markdown：确保 ERP 事实、链接和草稿动作可验证。
4. 草稿交接到既有业务编辑器，而不是 AI 直接建单：复用正式校验、权限、幂等和人工确认流程。
5. 治理能力拆分深链路，而不是单一大 Tab：便于权限、导航、告警跳转和后续模块化。
6. 前端消费后端 allowed/reason，而不是复制状态机：避免前后端权限与生命周期漂移。
7. 使用精确依赖 overrides，而不是 `npm audit fix --force`：降低 Ant Design Pro 主依赖树的破坏风险。
8. 默认双栏并把 Run 诊断放入 Drawer，而不是常驻第三栏：优先保证会话阅读宽度，诊断仍可随时打开且不丢失。

## 17. 相关文档

- `WEB_DEVELOPMENT.zh-CN.md`：Web 通用开发规则与当前页面接入约定。
- `DEVELOPMENT_PLAN.zh-CN.md`：Web 从模板到业务系统的阶段计划。
- `REQUEST_RESULT_CONTRACT.zh-CN.md`：领域 Service 与 `useRequest` 返回约定。
- `../../apps/myapp/AI_TECH_DESIGN.zh-CN.md`：AI 总体架构、业务边界与草稿设计。
- `../../apps/myapp/AI_MODEL_GOVERNANCE_TECH_DESIGN.zh-CN.md`：模型治理设计。
- `../../apps/myapp/AI_HIGH_CONCURRENCY_TECH_DESIGN.zh-CN.md`：并发、限流和 SLO 设计。
- `../../apps/myapp/API_GATEWAY.zh-CN.md`：后端 API 契约事实来源。
- `../../docs/codex/AI_COPILOT_COMPLETION_PLAN.zh-CN.md`：企业级收口计划和追踪矩阵。
- `../../docs/codex/CURRENT_HANDOFF.zh-CN.md`：最新工作区、验证和提交状态。
