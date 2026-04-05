---
aliases: [DMARC, DNS, Email Auth]
tags: [infra, dns, email, dmarc]
updated: 2026-04-05
---

# DMARC / SPF / DKIM Setup for tzai.it.com

## DMARC Record (TODO)

Add TXT record in Cloudflare DNS:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:info@tzai.it.com` | Auto |

### Steps in Cloudflare

1. Go to Cloudflare Dashboard > tzai.it.com > DNS > Records
2. Click "Add record"
3. Type: **TXT**
4. Name: `_dmarc`
5. Content: `v=DMARC1; p=none; rua=mailto:info@tzai.it.com`
6. TTL: Auto
7. Save

### Verify

```bash
dig TXT _dmarc.tzai.it.com
# Expected: "v=DMARC1; p=none; rua=mailto:info@tzai.it.com"
```

## Also Needed for Full Email Auth

| Record | Status | Purpose |
|--------|--------|---------|
| SPF | Check Resend docs | Authorize Resend to send from tzai.it.com |
| DKIM | Check Resend docs | Cryptographic signature |
| DMARC | **TODO** | Policy for failed auth |
| MX | Check | Route replies to inbox |

## Resend Domain Verification

Status: **Pending** (as of 2026-04-05)
Dashboard: https://resend.com/domains
