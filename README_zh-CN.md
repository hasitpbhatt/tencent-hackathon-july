# SHIP 产品规划助手

> 基于 CrewAI 构建的多 Agent 产品规划助手，部署在 EdgeOne Makers 上。产品经理、技术主管、设计师和评审员协作，通过交互式问答将你的产品想法转化为 PRD、技术方案和设计规范。

**Framework:** CrewAI · **Language:** Python

[![Deploy to EdgeOne Makers](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://console.cloud.tencent.com/edgeone/makers/new?template=shipkit-planner&from=within&fromAgent=1&agentLang=python)

## 概览

CrewAI 产品规划助手模拟一个产品团队：产品经理通过问答收集需求，然后与技术主管合作产出 PRD 和技术方案。评审员在每个阶段提供改进建议。整个过程基于对话驱动——你通过选择题或自由输入来引导方向。

- **多 Agent 协作** — 三个角色（PM、TL、Reviewer）通过 CrewAI Flow 按序协作
- **交互式问答** — PM 在起草前先提问澄清需求，你可以选择选项或自由输入
- **迭代优化** — 初稿完成后可持续反馈，直到满意为止
- **会话持久化** — 对话状态通过 Store 同步，跨实例可恢复
- **流式输出** — 通过 SSE 实时推送每个 Agent 的回复内容

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `AI_GATEWAY_API_KEY` | 是 | 模型网关 API Key。使用 **Makers Models API Key**，或任何 OpenAI 兼容的 Key。 |
| `AI_GATEWAY_BASE_URL` | 是 | 网关地址。Makers Models 使用 `https://ai-gateway.edgeone.link/v1`。 |
| `AI_GATEWAY_MODEL` | 否 | 模型 ID。默认为 `@makers/deepseek-v4-flash`（免费内置模型）。 |

> 本模板遵循 **OpenAI 兼容标准**，可对接 Makers Models 或任何兼容的模型网关。

### 如何获取 `AI_GATEWAY_API_KEY`

1. 打开 [Makers 控制台](https://console.cloud.tencent.com/edgeone/makers)。
2. 登录并开通 Makers。
3. 进入 **Makers → 模型 → API Key**，创建一个 Key。
4. 将 Key 填入 `AI_GATEWAY_API_KEY`（`AI_GATEWAY_BASE_URL` 填写 `https://ai-gateway.edgeone.link/v1`）。

内置模型（`@makers/deepseek-v4-flash`、`@makers/hy3-preview`、`@makers/minimax-m2.7`）免费但有频率限制，适合开发验证。生产环境建议在控制台绑定自有模型 Key（BYOK）。

## 本地开发

**前置依赖：** Node.js、npm、Python 3.11+

```bash
npm install
cp .env.example .env
edgeone makers dev
```

> CLI 会自动从 `agents/requirements.txt` 安装 Python 依赖。

打开 `http://localhost:8080/agent-metrics` 查看本地可观测面板。

## 项目结构

```text
crewai-planner-python/
├── agents/
│   ├── stream.py              # /stream — 主对话端点（SSE 流式）
│   ├── _lib/
│   │   ├── flow.py            # TurnFlow：基于 CrewAI Flow 的暂停/恢复机制
│   │   ├── llm.py             # LLM 单例初始化
│   │   ├── persistence.py     # 内存 + Store 持久化
│   │   ├── feedback_provider.py # 异步反馈提供者（抛出 HumanFeedbackPending）
│   │   └── logger.py          # 共享日志工厂
│   ├── _crews/
│   │   ├── agents.yaml        # Agent 角色定义（PM、TL、Reviewer）
│   │   ├── discovery_crew/    # 需求收集 Crew
│   │   ├── planning_crew/     # PRD + 技术方案生成 Crew
│   │   └── iteration_crew/    # 反馈迭代 Crew
│   └── requirements.txt       # Python 依赖
├── cloud-functions/
│   ├── history.py             # /history — 获取对话消息
│   └── delete.py              # /delete — 删除对话数据
├── src/                       # 前端（React + Tailwind）
├── edgeone.json               # Agent 运行时配置
└── package.json
```

> 以 `_` 为前缀的文件是私有模块，不会被 EdgeOne 暴露为公开路由。

## 工作原理

Agent 以**会话模式**运行：相同 `conversation_id` 的请求路由到同一实例。

### 工作流

1. **首轮** — 用户输入产品名称，PM 提出第一个问题，Flow 暂停（通过 `@human_feedback`）。
2. **需求收集阶段** — PM 提 2-3 轮问题（A/B/C 选项），收集足够上下文后转入起草阶段。
3. **起草阶段** — PM 编写 PRD，技术主管编写技术方案，评审员提出改进建议。Flow 暂停等待用户反馈。
4. **迭代阶段** — 用户提供反馈（或选择"确认完成"），PM 和 TL 逐条回应。循环至用户确认定稿。
5. **定稿** — PM 和 TL 输出最终版 PRD 和技术方案。

### 核心机制

- **CrewAI Flow + `@human_feedback`**：每次暂停抛出 `HumanFeedbackPending`，下一次 HTTP 请求通过 `resume_async(feedback)` 恢复。
- **流式输出**：CrewAI 的 `FlowStreamingOutput` 逐 token 推送 SSE 事件，附带 Agent 归属信息。
- **持久化**：内存字典存储 Flow 状态，`sync_pending_to_store()` 同步到平台 Store，跨实例可恢复。
- **历史记录**：`/history`（cloud function）读取存储的消息；`/delete` 清除对话数据。

### 路由

| 路由 | 方法 | 说明 |
|------|------|------|
| `/stream` | POST | 主对话轮次（SSE 流式） |
| `/history` | POST | 获取对话消息 |
| `/delete` | POST | 删除对话及 Flow 状态 |

`conversation_id` 通过 `makers-conversation-id` 请求头传递。

## 相关资源

- [Makers Agents 文档](https://cloud.tencent.com/document/product/1552/132759)
- [快速开始：Agent 开发](https://cloud.tencent.com/document/product/1552/132786)
- [Makers Models](https://cloud.tencent.com/document/product/1552/132748)

## License

MIT
