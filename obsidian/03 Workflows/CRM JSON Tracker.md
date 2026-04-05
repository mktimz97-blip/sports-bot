---
aliases: [CRM Tracker]
tags: [workflow, n8n, crm, active]
n8n_id: u0TwirCK2NQq2bXw
status: active
updated: 2026-04-02
---

# CRM — JSON File Lead Tracker

**ID**: `u0TwirCK2NQq2bXw`
**Status**: :green_circle: Active
**Trigger**: Webhook
**Nodes**: 6

## Flow

```
Webhook: New Lead → Save Lead → TG: Lead Saved
GET: All Leads → Read Leads → Respond
```

## Details

- POST webhook receives analyzed leads from LeadAnalyzer pipeline
- Saves to JSON file on VPS
- GET endpoint returns all stored leads
- TG notification on each new lead saved

## Local File

- `workflows/crm-json-file.json`
