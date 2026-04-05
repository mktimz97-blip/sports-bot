---
aliases: [LeadAnalyzer, Lead Analyzer V2]
tags: [workflow, n8n, leadgen, active]
n8n_id: Nv0iZdRiOB3vWav9
status: active
updated: 2026-04-05
---

# LeadAnalyzer — Google Search > Analyze > Smart Email

**ID**: `Nv0iZdRiOB3vWav9`
**Status**: :green_circle: Active
**Schedule**: Every 12 hours + Webhook trigger
**Nodes**: 17

## Architecture

```
Schedule (12h) → Search Queries → Serper Search → Extract Company URLs → LeadAnalyzer
Webhook POST → Parse Input → Needs Google? → (yes) Serper / (no) direct
                                                            ↓
                                                       Log to CRM
                                                            ↓
                                                      Score > 60?
                                                     ↓          ↓
                                            EmailComposer    TG: Skip
                                                  ↓
                                             Delay 10s → Send Email → TG: Sent
```

## Nodes

| # | Node | Type | Purpose |
|---|------|------|---------|
| 1 | Schedule (12h) | scheduleTrigger | Auto-run every 12 hours |
| 2 | Webhook Trigger | webhook | POST `/lead-analyzer` |
| 3 | Search Queries | code | 7 Google queries for RU/CIS companies |
| 4 | Serper Search | httpRequest | Google search via Serper.dev API |
| 5 | **Extract Company URLs** | code | Parse URLs from search results |
| 6 | LeadAnalyzer | code | 5-layer deep analysis |
| 7 | Log to CRM | code | Send lead to CRM webhook |
| 8 | Score > 60? | if | Filter high-quality leads |
| 9 | EmailComposer (Smart) | code | Generate branded RU+EN email |
| 10 | Delay 10s | code | Rate limiting |
| 11 | Send Email (Resend) | code | Send via Resend API |
| 12 | TG: Sent | telegram | Notify on success |
| 13 | TG: Skipped | telegram | Notify on skip |
| 14 | TG: Error | telegram | Notify on failure |
| 15 | Parse Webhook Input | code | Route webhook data |
| 16 | Needs Google? | if | Check if query needs search |

## 5-Layer Deep Scouting

1. **Site Analysis** — Serper `site:domain` (pages, structure, tech)
2. **Job Postings** — Serper `domain vacancies/hiring/jobs`
3. **Reviews & News** — Serper `domain reviews automation`
4. **Pain Point Detection** — 8 categories, keyword matching
5. **Scoring** — max 100, threshold 60+

## Fix Applied (2026-04-05)

**Bug**: `Extract Company URLs` threw `"json property isn't an object"` when Serper returned string instead of JSON object.

**Root cause**: HTTP Request node returned unparsed string on API errors/timeouts.

**Fix**:
- Added defensive `typeof data === 'string'` check with `JSON.parse` fallback
- Null/array guard: `if (!data || typeof data !== 'object')`
- Safe `item.link` access
- Empty result fallback: returns `{skip: true}` instead of empty array

## Test Webhook

```bash
curl -X POST http://134.122.87.138:5678/webhook/lead-analyzer \
  -H 'Content-Type: application/json' \
  -d '{"domain": "acid21.com"}'
```
