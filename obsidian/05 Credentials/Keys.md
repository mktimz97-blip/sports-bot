---
aliases: [API Keys, Credentials]
tags: [credentials, keys, security]
updated: 2026-04-05
---

# API Keys & Credentials

> :warning: **Security**: Keys below are referenced from n8n workflow code nodes.
> Production keys should be moved to n8n environment variables.

## Services

| Service | Key Location | Status |
|---------|-------------|--------|
| Serper.dev (Google Search) | n8n workflow code | :green_circle: Active |
| Resend (Email) | n8n workflow code | :green_circle: Active (sandbox) |
| Telegram Bot API | n8n workflow code | :green_circle: Active |
| Hunter.io | `process.env.HUNTER_API_KEY` | :yellow_circle: Optional |
| n8n API | Provided per session | :green_circle: Active |

## Telegram Bot

| Property | Value |
|----------|-------|
| Bot | @tzai_notify_bot |
| Chat ID | 120786192 |

## n8n Access

| Property | Value |
|----------|-------|
| URL | http://134.122.87.138:5678 |
| Login | admin |
| API | Settings > API > Create key |

## Email Sending

| Property | Value |
|----------|-------|
| Provider | Resend |
| FROM (current) | `onboarding@resend.dev` (sandbox) |
| FROM (target) | `info@tzai.it.com` (pending DNS) |
| Reply path | IMAP → Claude AI → Resend |

## SMTP (legacy)

| Property | Value |
|----------|-------|
| Server | smtp.mail.ru:465 (SSL) |
| Address | tzai.flow@mail.ru |
| Status | :red_circle: Replaced by Resend |

## Environment Variables (`.env.example`)

```
N8N_API_KEY=
HUNTER_API_KEY=
SERPER_API_KEY=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=120786192
RESEND_API_KEY=
QWEN_BASE_URL=http://localhost:11434
```
