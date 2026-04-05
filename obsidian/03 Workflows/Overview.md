---
aliases: [Workflows, n8n Overview]
tags: [workflows, n8n]
updated: 2026-04-05
---

# n8n Workflows Overview

## Active Workflows (8)

| ID | Workflow | Nodes | Schedule | Updated |
|----|----------|-------|----------|---------|
| `Nv0iZdRiOB3vWav9` | [[LeadAnalyzer]] | 17 | Every 12h | 2026-04-05 |
| `sQ1Bb8AjYQ9Sy4H3` | [[LeadFinder Pipeline]] | 11 | Every 6h | 2026-04-03 |
| `eMoXvRtGQ3OQ4ykW` | [[Auto-Reply IMAP]] | 8 | Every 30min | 2026-04-05 |
| `RRZK7Y4h2g0ldBTC` | [[Daily Lead Summary]] | 3 | Daily 9:00 | 2026-04-02 |
| `4VYuMZC1XSbmUoC2` | [[Health Check Dashboard]] | 4 | Every 6h | 2026-04-03 |
| `u0TwirCK2NQq2bXw` | [[CRM JSON Tracker]] | 6 | On webhook | 2026-04-02 |
| `tzai-telegram-daily` | [[TZAI Telegram Notifications]] | 2 | Daily | 2026-04-01 |

## Inactive Templates (19)

| Category | Workflows |
|----------|-----------|
| CRM | HR Job Posting, Webhook Workflow, Gmail Auto-responder, Resume Review, CV Screening |
| AI | Multi-AI Agent Chatbot, Email Management, Telegram AI-bot, Pyragogy AI Village, Deep Research |
| Reporting | Google Analytics, YouTube Analyzer, YouTube Playlist, News Extraction, Info Monitoring |
| Monitoring | SMS on Failure, Error Logger, AirQuality, Competitor Pricing, Birthday Reminders |

## Pipeline Flow

```
Schedule (12h) ──→ Search Queries ──→ Serper Search ──→ Extract URLs ──→ LeadAnalyzer
Webhook POST ──→ Parse Input ──→ Needs Google? ─┬→ Serper Search (yes)
                                                 └→ LeadAnalyzer (no, has URL)
                                                          ↓
                                                     Log to CRM
                                                          ↓
                                                    Score > 60?
                                                   ↓          ↓
                                          EmailComposer   TG: Skipped
                                                ↓
                                           Delay 10s
                                                ↓
                                          Send Email
                                                ↓
                                           TG: Sent
```
