---
aliases: [Auto-Reply, IMAP Auto Reply]
tags: [workflow, n8n, email, ai, active]
n8n_id: eMoXvRtGQ3OQ4ykW
status: active
updated: 2026-04-05
---

# Auto-Reply — IMAP > Claude AI > Resend

**ID**: `eMoXvRtGQ3OQ4ykW`
**Status**: :green_circle: Active
**Schedule**: Every 30 minutes
**Nodes**: 8

## Flow

```
Every 30min → Init State → Fetch Emails (IMAP) → Filter & Dedup → Should Reply?
                                                                        ↓
                                                              Claude AI Reply
                                                                        ↓
                                                              Send via Resend
                                                                        ↓
                                                              TG: Reply Sent
```

## Details

- IMAP fetch from inbox
- Dedup with 24h timestamped cache
- Claude Haiku AI generates reply (same language, mention TZAI services, invite to call)
- Send via Resend API
- TG notification on each reply sent

## Local File

- `workflows/auto-reply.json`
