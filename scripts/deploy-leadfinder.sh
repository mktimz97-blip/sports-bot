#!/bin/bash
# Deploy LeadFinder pipeline to n8n on VPS
# Usage: bash scripts/deploy-leadfinder.sh

set -euo pipefail

VPS_HOST="134.122.87.138"
N8N_PORT="5678"
N8N_URL="http://${VPS_HOST}:${N8N_PORT}"
WORKFLOW_FILE="config/n8n-leadfinder-workflow.json"

echo "=== LeadFinder Pipeline Deployment ==="
echo "Target: ${N8N_URL}"
echo ""

# ── Step 1: Check n8n is reachable ──
echo "[1/5] Checking n8n availability..."
if ! curl -sf --max-time 10 "${N8N_URL}/healthz" > /dev/null 2>&1; then
  echo "  WARNING: n8n healthz not responding, trying API..."
  if ! curl -sf --max-time 10 "${N8N_URL}/api/v1/workflows" -H "X-N8N-API-KEY: ${N8N_API_KEY:-}" > /dev/null 2>&1; then
    echo "  ERROR: Cannot reach n8n at ${N8N_URL}"
    echo "  Make sure n8n is running: ssh root@${VPS_HOST} 'docker ps | grep n8n'"
    exit 1
  fi
fi
echo "  OK: n8n is reachable"

# ── Step 2: Validate API key ──
echo "[2/5] Validating API key..."
if [ -z "${N8N_API_KEY:-}" ]; then
  echo "  ERROR: N8N_API_KEY environment variable not set"
  echo "  Set it: export N8N_API_KEY=your-api-key"
  echo "  Get it from: ${N8N_URL}/settings/api"
  exit 1
fi

RESPONSE=$(curl -sf "${N8N_URL}/api/v1/workflows?limit=1" \
  -H "X-N8N-API-KEY: ${N8N_API_KEY}" 2>&1) || {
  echo "  ERROR: API key rejected"
  exit 1
}
echo "  OK: API key valid"

# ── Step 3: Check for existing LeadFinder workflow ──
echo "[3/5] Checking for existing LeadFinder workflow..."
EXISTING=$(curl -sf "${N8N_URL}/api/v1/workflows" \
  -H "X-N8N-API-KEY: ${N8N_API_KEY}" | \
  python3 -c "import sys,json; wfs=json.load(sys.stdin).get('data',[]); matches=[w for w in wfs if 'LeadFinder' in w.get('name','')]; print(matches[0]['id'] if matches else '')" 2>/dev/null || echo "")

if [ -n "$EXISTING" ]; then
  echo "  Found existing workflow ID: ${EXISTING}"
  echo "  Updating..."
  METHOD="PUT"
  ENDPOINT="${N8N_URL}/api/v1/workflows/${EXISTING}"
else
  echo "  No existing workflow, creating new..."
  METHOD="POST"
  ENDPOINT="${N8N_URL}/api/v1/workflows"
fi

# ── Step 4: Deploy workflow ──
echo "[4/5] Deploying workflow..."
RESULT=$(curl -sf -X "${METHOD}" "${ENDPOINT}" \
  -H "X-N8N-API-KEY: ${N8N_API_KEY}" \
  -H "Content-Type: application/json" \
  -d @"${WORKFLOW_FILE}") || {
  echo "  ERROR: Deployment failed"
  echo "  Response: ${RESULT:-none}"
  exit 1
}

WF_ID=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id','unknown'))" 2>/dev/null || echo "unknown")
echo "  OK: Workflow deployed (ID: ${WF_ID})"

# ── Step 5: Activate workflow ──
echo "[5/5] Activating workflow..."
curl -sf -X PATCH "${N8N_URL}/api/v1/workflows/${WF_ID}" \
  -H "X-N8N-API-KEY: ${N8N_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"active": true}' > /dev/null 2>&1 || echo "  WARNING: Could not auto-activate"

echo ""
echo "=== Deployment Complete ==="
echo ""
echo "Workflow: ${N8N_URL}/workflow/${WF_ID}"
echo "Webhook:  ${N8N_URL}/webhook/leadfinder"
echo ""
echo "── Required n8n Setup ──"
echo ""
echo "1. Set environment variables in n8n Settings > Variables:"
echo "   HUNTER_API_KEY  = your Hunter.io API key"
echo "   TG_CHAT_ID      = 120786192"
echo ""
echo "2. Create credentials in n8n:"
echo "   - SMTP: Mail.ru (smtp.mail.ru:465, SSL)"
echo "   - Telegram Bot API (use existing bot token)"
echo ""
echo "3. Update credential IDs in the workflow:"
echo "   - Send Email node → select 'Mail.ru SMTP' credential"
echo "   - TG nodes → select 'TZAI Telegram Bot' credential"
echo ""
echo "── Test via webhook ──"
echo "curl -X POST ${N8N_URL}/webhook/leadfinder \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"domain\": \"acid21.com\"}'"
