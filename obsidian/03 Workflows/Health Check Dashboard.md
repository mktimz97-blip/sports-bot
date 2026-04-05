---
aliases: [Health Check]
tags: [workflow, n8n, monitoring, active]
n8n_id: 4VYuMZC1XSbmUoC2
status: active
updated: 2026-04-03
---

# TZAI Health Check Dashboard

**ID**: `4VYuMZC1XSbmUoC2`
**Status**: :green_circle: Active
**Schedule**: Every 6 hours
**Nodes**: 4

## Flow

```
Every 6 Hours → Check All Workflows → Send TG Report
Manual Trigger ↗
```

## Details

- Checks all active workflows via n8n internal API
- Sends Telegram report with per-workflow status
- Manual trigger available for on-demand checks
