---
aliases: [VPS, Server, Infrastructure]
tags: [infra, vps, digitalocean]
updated: 2026-04-05
---

# VPS Infrastructure

## Server Details

| Property | Value |
|----------|-------|
| IP | 134.122.87.138 |
| Provider | DigitalOcean |
| Cost | $12/mo |
| OS | Ubuntu 24.04 |
| Location | Frankfurt |
| SSH Key | `~/.ssh/tzai_key` |

## Connect

```bash
ssh -i ~/.ssh/tzai_key root@134.122.87.138
```

## Services Running

| Service | Port | URL | Status |
|---------|------|-----|--------|
| n8n | 5678 | http://134.122.87.138:5678 | :green_circle: Active |
| Qdrant | 6333 | http://134.122.87.138:6333 | :green_circle: Active |

## n8n Credentials

- Admin: `admin`
- Docker compose: `/opt/tzai/docker-compose.yml`

## Docker Stack

```yaml
# /opt/tzai/docker-compose.yml
services:
  n8n:
    image: n8nio/n8n
    ports: ["5678:5678"]
  qdrant:
    image: qdrant/qdrant
    ports: ["6333:6333"]
```
