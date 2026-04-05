---
aliases: [Agents Overview]
tags: [agents, domains, architecture]
updated: 2026-04-05
---

# Agents & Domains — RuFlo V3.5

## DDD Bounded Contexts

| Domain | File | Purpose |
|--------|------|---------|
| [[Agent Domain]] | `src/domains/agent/AgentDomain.ts` | Agent lifecycle management |
| [[LeadAnalyzer Agent]] | `src/domains/agent/LeadAnalyzer.ts` | Company analysis & lead scoring |
| Swarm | `src/domains/swarm/SwarmDomain.ts` | Multi-agent swarm coordination |
| Memory | `src/domains/memory/MemoryDomain.ts` | AgentDB memory with HNSW search |
| Security | `src/domains/security/SecurityDomain.ts` | Input validation, auth |
| Workflow | `src/domains/workflow/WorkflowDomain.ts` | Workflow orchestration |

## Integrations

| Integration | File | Purpose |
|-------------|------|---------|
| n8n Connector | `src/integrations/n8n/N8nConnector.ts` | n8n API client |
| Zie619 Loader | `src/integrations/n8n/Zie619Loader.ts` | Import 2077+ workflow templates |
| Model Router | `src/integrations/llm/ModelRouter.ts` | 3-tier LLM routing |
| Qwen Connector | `src/integrations/llm/QwenConnector.ts` | Local Qwen 3:8B |
| Nemotron | `src/integrations/llm/NemotronConnector.ts` | Nemotron LLM |
| Agency Swarm | `src/integrations/agents/AgencySwarm.ts` | Multi-agent framework |
| LeadGen Pipeline | `src/integrations/agents/LeadGenPipeline.ts` | Lead generation orchestration |

## LeadAnalyzer Agent Details

The core agent for the TZAI lead generation pipeline.

### Analysis Pipeline

1. **Fetch site content** — HTTP GET with redirect following
2. **Company profile** — Extract name, industry, size from HTML
3. **Job postings** — hh.ru API + LinkedIn via Serper
4. **Financial signals** — hh.ru employers + zakupki.gov.ru tenders
5. **Pain points** — 8 pattern categories with keyword matching
6. **Solutions** — Map pain points to TZAI products
7. **Contacts** — Hunter.io API or fallback to `info@domain`
8. **Scoring** — max 100, factors: pain points, jobs, signals
9. **Webhook** — Send report to n8n for email pipeline

### Config

```typescript
{
  webhookUrl: 'http://134.122.87.138:5678/webhook/leadfinder',
  hunterApiKey: process.env.HUNTER_API_KEY,
  serperApiKey: process.env.SERPER_API_KEY,
  hhApiEnabled: true,
  zakupkiEnabled: true,
  timeoutMs: 15000
}
```
