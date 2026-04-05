---
aliases: [TZAI Home, Dashboard]
tags: [dashboard, tzai]
---

# TZAI Ecosystem Dashboard

> **TZAI Company Group** — AI Automation for RU/CIS businesses
> CEO: Timur Alisherovich | @Salvatore_Lazzaro

---

## Quick Links

| Resource | Link |
|----------|------|
| n8n | http://134.122.87.138:5678 |
| Website | https://mktimz97-blip.github.io/tzai-website/ |
| VPS SSH | `ssh -i ~/.ssh/tzai_key root@134.122.87.138` |
| GitHub (bot) | https://github.com/mktimz97-blip/sports-bot |
| GitHub (site) | https://github.com/mktimz97-blip/tzai-website |
| Qdrant | http://134.122.87.138:6333 |

---

## Active Workflows (n8n)

| Status | Workflow | Schedule |
|--------|----------|----------|
| :green_circle: | [[LeadAnalyzer]] | Every 12h |
| :green_circle: | [[LeadFinder Pipeline]] | Every 6h |
| :green_circle: | [[Auto-Reply IMAP]] | Every 30min |
| :green_circle: | [[Daily Lead Summary]] | Daily 9:00 |
| :green_circle: | [[Health Check Dashboard]] | Every 6h |
| :green_circle: | [[CRM JSON Tracker]] | On webhook |
| :green_circle: | [[TZAI Telegram Notifications]] | Daily |

---

## Ecosystem Map

```
[Search Queries] → [Serper API] → [Extract URLs] → [LeadAnalyzer]
                                                        ↓
                                              [Score > 60?]
                                              ↓           ↓
                                    [EmailComposer]   [TG: Skip]
                                         ↓
                                    [Resend API]
                                         ↓
                                    [TG: Sent]
```

---

## Navigation

- [[01 Context/TZAI Context|Full Context]]
- [[02 Infrastructure/VPS|Infrastructure]]
- [[03 Workflows/Overview|Workflows Overview]]
- [[04 Agents/Overview|Agents & Domains]]
- [[05 Credentials/Keys|API Keys & Credentials]]
- [[06 Daily/2026-04-05|Today's Log]]
- [[07 Plan/Roadmap|Roadmap & Plan]]
- [[08 Codebase/Architecture|Codebase Architecture]]
