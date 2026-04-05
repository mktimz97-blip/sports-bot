---
aliases: [Plan, Roadmap, TODO]
tags: [plan, roadmap, todo]
updated: 2026-04-05
---

# TZAI Roadmap & Plan

## Priority 1 — Immediate (this week)

- [ ] **Verify tzai.it.com domain** in Resend — add DNS records, switch FROM to `info@tzai.it.com`
- [ ] **Test full pipeline end-to-end** — trigger LeadAnalyzer → verify email → verify TG
- [ ] **Monitor Auto-Reply** — confirm Claude AI replies going out correctly
- [ ] **Expand LeadFinder domain list** — add 50+ RU/CIS companies
- [ ] **Update Search Queries** in LeadAnalyzer — add industry-specific Russian queries

## Priority 2 — Near-term (next 2 weeks)

- [ ] **Add unsubscribe link** to email templates (CAN-SPAM / GDPR)
- [ ] **Email tracking** — open/click tracking via Resend webhooks
- [ ] **Import Hunter workflow** — email discovery by domain (`integrations/zie619-workflows/Hunter/`)
- [ ] **Import Emailreadimap workflow** — read inbox + TG notification
- [ ] **Link full chain**: LeadFinder → Hunter → EmailComposer → Send → TG Report
- [ ] **Google Sheets CRM** — migrate from JSON file tracker
- [ ] **Move API keys** from workflow code to n8n environment variables

## Priority 3 — Growth (month)

- [ ] **50+ daily leads** — scale Serper queries, add more industry verticals
- [ ] **A/B test emails** — test different pain point messaging
- [ ] **Landing pages** per solution (DataFlow, SupportBot, etc.)
- [ ] **Client portal** — dashboard showing automation ROI
- [ ] **Qwen local AI** — reduce Claude API costs for routine tasks
- [ ] **Activate template workflows** — evaluate 19 inactive n8n templates

## Tech Debt

- [ ] Clean up junk files in project root (`0)`, `6}`, `{,+`, `{const`, `n.name`, etc.)
- [ ] Move BingX files to separate repo or archive
- [ ] Set up proper CI/CD (build + test on push)
- [ ] Add integration tests for LeadAnalyzer TypeScript agent
- [ ] Consolidate LeadFinder + LeadAnalyzer into single workflow

## Architecture Goals

```
Current:  n8n workflows (code nodes) → Serper → Resend → TG
Target:   RuFlo agents (TypeScript) → n8n orchestration → multi-channel outreach
          └→ Qwen local AI for analysis
          └→ Hunter for email discovery
          └→ Google Sheets CRM
          └→ Analytics dashboard
```
