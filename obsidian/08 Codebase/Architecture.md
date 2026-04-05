---
aliases: [Architecture, Codebase]
tags: [architecture, codebase, ddd]
updated: 2026-04-05
---

# Codebase Architecture — RuFlo V3.5

## Project Structure

```
C:\projects\myproject\
├── src/
│   ├── index.ts                          # Entry point, exports all domains
│   ├── domains/
│   │   ├── agent/
│   │   │   ├── AgentDomain.ts            # Agent lifecycle
│   │   │   └── LeadAnalyzer.ts           # Core lead analysis agent
│   │   ├── swarm/SwarmDomain.ts          # Multi-agent coordination
│   │   ├── memory/MemoryDomain.ts        # HNSW memory search
│   │   ├── security/SecurityDomain.ts    # Auth & validation
│   │   └── workflow/WorkflowDomain.ts    # Workflow orchestration
│   ├── integrations/
│   │   ├── n8n/
│   │   │   ├── N8nConnector.ts           # n8n REST API client
│   │   │   └── Zie619Loader.ts           # 2077+ workflow importer
│   │   ├── llm/
│   │   │   ├── ModelRouter.ts            # 3-tier model routing
│   │   │   ├─�� QwenConnector.ts          # Local Qwen 3:8B
│   │   │   └── NemotronConnector.ts      # Nemotron LLM
│   │   └── agents/
│   │       ├── AgencySwarm.ts            # Multi-agent framework
│   │       └── LeadGenPipeline.ts        # Lead gen orchestration
│   ├── shared/
│   │   ├── events/
│   │   │   ├── DomainEvent.ts            # Event types
│   │   │   └── EventBus.ts              # Pub/sub bus
│   │   └── types/Result.ts              # Result<T> monad
│   └── demos/
│       ├── business-case.ts
│       ├── daily-report.ts
│       ├── integrations-demo.ts
│       └── final-product-demo.ts
├── workflows/                            # n8n workflow JSON exports
│   ├── lead-analyzer-workflow.json
│   ├── auto-reply.json
│   ├── crm-google-sheets.json
│   ├── crm-json-file.json
│   └── daily-lead-summary.json
├── config/
│   ├── n8n.config.json                   # n8n connection config
│   └── n8n-leadfinder-workflow.json      # Deploy-ready workflow
├── scripts/
│   ├── deploy-leadfinder.sh              # n8n API deploy script
│   ├── send-leads.js                     # Manual email sender
│   └── setup-ollama-qwen.ps1            # Local LLM setup
├── tests/domains/                        # Jest tests
├── integrations/zie619-workflows/        # 2077+ workflow templates (git submodule)
├── docs/
│   ├── TZAI_CONTEXT.md
│   └── leadgen-emails-30.md             # 30 email templates
└── package.json                          # ruflo-v3 v3.5.0
```

## Build & Run

```bash
npm run build    # tsc compile
npm test         # jest
npm run dev      # ts-node src/index.ts
```

## 3-Tier Model Routing

| Tier | Handler | Latency | Use Case |
|------|---------|---------|----------|
| 1 | Agent Booster (WASM) | <1ms | Simple transforms |
| 2 | Haiku | ~500ms | Low complexity (<30%) |
| 3 | Sonnet/Opus | 2-5s | Complex reasoning (>30%) |

## Event Sourcing

All domain changes emit `DomainEvent` via `EventBus`:
- `LeadAnalysisStarted`, `LeadAnalysisCompleted`, `LeadAnalysisFailed`
- `LeadWebhookSent`, `LeadWebhookFailed`
- `LeadBatchCompleted`
