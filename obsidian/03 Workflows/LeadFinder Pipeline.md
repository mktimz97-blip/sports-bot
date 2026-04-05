---
aliases: [LeadFinder]
tags: [workflow, n8n, leadgen, active]
n8n_id: sQ1Bb8AjYQ9Sy4H3
status: active
updated: 2026-04-03
---

# LeadFinder Pipeline

**ID**: `sQ1Bb8AjYQ9Sy4H3`
**Status**: :green_circle: Active
**Nodes**: 11

## Flow

```
Schedule Trigger → Domain List → Has Domain? → Set Domains → LeadAnalyzer
Webhook Trigger ↗                                                ↓
                                                          EmailComposer
                                                                ↓
                                                          Send Delay → Send Email
                                                                          ↓
                                                                    TG: Email Sent
                                                                    TG: Error
```

## Details

- Static domain list: 18 RU/CIS companies
- Fetches site via `this.helpers.httpRequest`
- Pain point detection by keyword matching
- Email via Resend API (`onboarding@resend.dev` sandbox)
- TG notification via direct Bot API

## Local Files

- Workflow JSON: `workflows/lead-analyzer-workflow.json` (combined)
- Deploy script: `scripts/deploy-leadfinder.sh`
- Config: `config/n8n-leadfinder-workflow.json`
