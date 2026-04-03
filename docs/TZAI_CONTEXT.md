# TZAI Ecosystem Context — 2026-04-03

## Infrastructure

- **VPS**: 134.122.87.138
- **n8n**: http://134.122.87.138:5678
- **Website**: https://mktimz97-blip.github.io/tzai-website/
- **GitHub**: https://github.com/mktimz97-blip/sports-bot (master)
- **Website repo**: https://github.com/mktimz97-blip/tzai-website (master)

## n8n Workflows (6 total)

| ID | Name | Status | Schedule |
|----|------|--------|----------|
| sQ1Bb8AjYQ9Sy4H3 | LeadFinder Pipeline | Active, Fixed | Every 6 hours |
| Nv0iZdRiOB3vWav9 | LeadAnalyzer — Google Search → Analyze → Smart Email | Active, V2 Rebuilt | Every 12 hours |
| u0TwirCK2NQq2bXw | CRM — JSON File Lead Tracker | Active | On webhook |
| RRZK7Y4h2g0ldBTC | Daily Lead Summary — 9AM Telegram Report | Active | Daily 9:00 |
| eMoXvRtGQ3OQ4ykW | Auto-Reply — IMAP → Claude AI → Resend | Active, Fixed | Every 30 min |
| 4VYuMZC1XSbmUoC2 | TZAI Health Check Dashboard | Active | Every 6 hours |

## Required Environment Variables

See `.env.example` for the full list. Keys are stored in n8n workflow code nodes (not in env vars).

## Workflow Details

### LeadFinder (sQ1Bb8AjYQ9Sy4H3)
- Static domain list: 18 RU/CIS companies
- Fetches site via `this.helpers.httpRequest`
- Detects pain points by keyword matching
- Sends email via Resend API (onboarding@resend.dev — sandbox)
- TG notification via direct Bot API

### LeadAnalyzer V2 (Nv0iZdRiOB3vWav9)
- 5-layer deep scouting:
  1. hh.ru API — vacancies, days open, pain type classification
  2. Website deep scan — 7 pages, 1C/SAP/Excel/manual process detection
  3. News & reputation — Serper: growth, reviews, complaints
  4. Government data — zakupki.gov.ru tenders
  5. LinkedIn — job postings
- 12 pain categories (rubles): DataFlow, IntegrationHub, SupportBot, HireSmart, DocProcessor, LeadEngine, ContentGen, Insights, LogiFlow, FinanceBot, LegalAI, ProcureAI
- Scoring: max 100, threshold 60+
- EmailComposer V2.2: evidence-based, Russian only, no internal scores shown

### Auto-Reply (eMoXvRtGQ3OQ4ykW)
- IMAP → Filter & Dedup (24h timestamped cache) → Claude Haiku AI Reply → Resend → TG
- Claude system prompt: reply in same language, mention TZAI services, invite to call
- FROM: onboarding@resend.dev (sandbox until tzai.it.com verified)

### Health Check (4VYuMZC1XSbmUoC2)
- Checks all 5 workflows via n8n API
- Sends TG report with status per workflow

## Contact Info (in emails/signatures)

- **Name**: Timur Alisherovich
- **Title**: CEO & AI Automation Architect
- **Company**: TZAI Company Group
- **Telegram**: @Salvatore_Lazzaro
- **Phone**: +7 905 506 61 55
- **Email**: info@tzai.it.com
- **TG Bot**: @tzai_notify_bot
- **TG Chat**: 120786192

## Domain Status

- **tzai.it.com**: Resend status `pending` — DNS records need verification
- **Current FROM**: onboarding@resend.dev (Resend sandbox)
- **Target FROM**: info@tzai.it.com (after domain verification)

## Fixes Applied Today (2026-04-03)

1. LeadAnalyzer rebuilt with 5-layer scouting + evidence-based emails
2. All TG notifications switched from n8n credential nodes to direct Bot API
3. Auto-Reply: fixed process.env, dedup cache, email extraction, encoding
4. LeadFinder: fixed fetch() → httpRequest, SMTP → Resend, webhook responseMode
5. Website: updated stats, added live feed, "Как мы нашли вас" block, RU/CIS focus
6. All emails updated: tzai.flow@mail.ru → info@tzai.it.com
7. Health Check Dashboard workflow created

## Tomorrow's Tasks

1. **Verify tzai.it.com domain** in Resend — add DNS records, switch FROM to info@tzai.it.com
2. **Expand LeadFinder domain list** — add 50+ RU/CIS companies across target industries
3. **Update Search Queries** in LeadAnalyzer — add industry-specific Russian queries
4. **Test full pipeline end-to-end** — trigger LeadFinder → verify email arrives → verify TG notification
5. **Monitor Auto-Reply** — confirm Claude AI replies are going out correctly
6. **Add unsubscribe link** to email template (CAN-SPAM / GDPR compliance)
7. **Set up email tracking** — open/click tracking via Resend webhooks
