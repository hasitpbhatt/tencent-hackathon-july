# CrewAI Product Planner

> A multi-agent product planning assistant built with CrewAI on EdgeOne Makers — a PM, Tech Lead, and Reviewer collaborate to turn your product idea into a PRD and Tech Spec through interactive Q&A.

**Framework:** CrewAI · **Category:** Quick Start · **Language:** Python

[![Deploy to EdgeOne Makers](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://edgeone.ai/makers/new?template=crewai-product-planner-starter&from=within&fromAgent=1&agentLang=python)

## Overview

CrewAI Product Planner simulates a product team: a Product Manager interviews you to gather requirements, then collaborates with a Tech Lead to produce a PRD and Technical Specification. A Reviewer provides improvement suggestions at each stage. The entire process is conversational — you guide the direction through multiple-choice options or free-text input.

- **Multi-agent orchestration** — three agents (PM, Tech Lead, Reviewer) with distinct roles working in sequence via CrewAI Flows
- **Interactive Q&A** — the PM asks clarifying questions before drafting; you choose from options or type custom answers
- **Iterative refinement** — after the initial draft, continue providing feedback until you're satisfied with the final documents
- **Session persistence** — conversation state is recoverable across instances via external store sync
- **Streaming output** — real-time SSE streaming of agent responses with per-agent attribution

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AI_GATEWAY_API_KEY` | Yes | Model gateway API key. Use your **Makers Models API Key**, or any OpenAI-compatible provider key. |
| `AI_GATEWAY_BASE_URL` | Yes | Gateway base URL. For Makers Models, use `https://ai-gateway.edgeone.link/v1`. |
| `AI_GATEWAY_MODEL` | No | Model ID. Defaults to `@makers/deepseek-v4-flash` (a free built-in model). |

> This template follows the **OpenAI-compatible** standard — you can point these variables at Makers Models or any other compatible gateway / provider.

### How to get `AI_GATEWAY_API_KEY`

1. Open the [Makers Console](https://edgeone.ai/makers/new?s_url=https://console.tencentcloud.com/edgeone/makers).
2. Sign in and enable Makers.
3. Go to **Makers → Models → API Key** and create a key.
4. Copy it into `AI_GATEWAY_API_KEY` (set `AI_GATEWAY_BASE_URL` to `https://ai-gateway.edgeone.link/v1`).

Built-in models (`@makers/deepseek-v4-flash`, `@makers/hy3-preview`, `@makers/minimax-m2.7`) are free and rate-limited — great for prototyping. For production, bind your own provider key (BYOK) in the console.

## Local Development

**Prerequisites:** Node.js, npm, Python 3.11+

```bash
npm install
cp .env.example .env
edgeone makers dev
```

> The CLI automatically installs Python dependencies from `agents/requirements.txt`.

Open `http://localhost:8080/agent-metrics` for the local observability panel.

## Project Structure

```text
crewai-planner-python/
├── agents/
│   ├── stream.py              # /stream — main conversation endpoint (SSE)
│   ├── _lib/
│   │   ├── flow.py            # TurnFlow: CrewAI Flow with pause/resume
│   │   ├── llm.py             # LLM singleton initialization
│   │   ├── persistence.py     # In-memory + store-backed state persistence
│   │   ├── feedback_provider.py # Async feedback provider (raises HumanFeedbackPending)
│   │   └── logger.py          # Shared logger factory
│   ├── _crews/
│   │   ├── agents.yaml        # Agent role definitions (PM, TL, Reviewer)
│   │   ├── discovery_crew/    # Requirements gathering crew
│   │   ├── planning_crew/     # PRD + Tech Spec generation crew
│   │   └── iteration_crew/    # Feedback iteration crew
│   └── requirements.txt       # Python dependencies
├── cloud-functions/
│   ├── history.py             # /history — retrieve conversation messages
│   └── delete.py              # /delete — delete conversation data
├── src/                       # Frontend (React + Tailwind)
├── edgeone.json               # Agent runtime configuration
└── package.json
```

> Files prefixed with `_` are private modules — not exposed as public routes by EdgeOne.

## How It Works

The agent runs as a **session-mode** runtime: requests sharing the same `conversation_id` are routed to the same instance.

### Workflow

1. **First turn** — user enters a product name. The PM agent asks a clarifying question and the Flow pauses (via `@human_feedback`).
2. **Discovery phase** — the PM asks 2-3 rounds of questions (A/B/C options). After enough context is gathered (or 3 rounds), the Flow transitions to drafting.
3. **Drafting phase** — the PM writes a PRD, the Tech Lead writes a Technical Specification, and the Reviewer suggests improvements. The Flow pauses for user feedback.
4. **Iteration phase** — user provides feedback (or selects "looks good"). The PM and TL respond to each piece of feedback. This loop continues until the user confirms finalization.
5. **Finalization** — PM and TL produce the final versions of both documents.

### Key Mechanisms

- **CrewAI Flow + `@human_feedback`**: each pause raises `HumanFeedbackPending`; the next HTTP request resumes via `resume_async(feedback)`.
- **Streaming**: CrewAI's `FlowStreamingOutput` delivers token-by-token SSE events with agent attribution.
- **Persistence**: in-memory dict stores Flow state; `sync_pending_to_store()` backs it up to the platform store so state is recoverable across instances.
- **Session history**: `/history` (cloud function) reads stored messages; `/delete` clears conversation data.

### Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/stream` | POST | Main conversation turn (SSE streaming) |
| `/history` | POST | Retrieve conversation messages |
| `/delete` | POST | Delete conversation and flow state |

The `conversation_id` is passed via the `makers-conversation-id` request header.

## Resources

- [Makers Agents Documentation](https://pages.edgeone.ai/document/agents)
- [Quick Start: Agent Development](https://pages.edgeone.ai/document/agents-quick-start)
- [Makers Models](https://pages.edgeone.ai/document/models)

## License

MIT
