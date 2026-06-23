#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:4000}"
RUN_ID="${RUN_ID:-$(date +%s)}"
VIEWER_ID="${VIEWER_ID:-demo-viewer-${RUN_ID}}"
WALLET_ADDRESS="${WALLET_ADDRESS:-0xdemo}"
STREAM_ID="${STREAM_ID:-demo-stream-${RUN_ID}}"
CAMPAIGN_ID="${CAMPAIGN_ID:-owncast-payflow-creator}"

json_post() {
  local path="$1"
  local body="$2"
  curl -sS \
    -X POST "${BASE_URL}${path}" \
    -H "Content-Type: application/json" \
    -d "${body}"
  printf "\n"
}

echo "Health"
curl -sS "${BASE_URL}/health"
printf "\n\n"

echo "Approve viewer session"
json_post "/session/start" "{
  \"viewerUserId\":\"${VIEWER_ID}\",
  \"walletAddress\":\"${WALLET_ADDRESS}\",
  \"authorizationId\":\"demo-auth\",
  \"spendingCapUSDC\":\"1.00\",
  \"expiresAt\":\"2099-06-23T19:00:00.000Z\"
}"
printf "\n"

echo "Owncast USER_JOINED"
json_post "/webhook" "{
  \"id\":\"demo-join-${RUN_ID}\",
  \"type\":\"USER_JOINED\",
  \"eventData\":{
    \"id\":\"${STREAM_ID}\",
    \"timestamp\":\"2026-06-23T18:00:00.000Z\",
    \"user\":{\"id\":\"${VIEWER_ID}\"}
  }
}"
printf "\n"

echo "Owncast USER_PARTED"
json_post "/webhook" "{
  \"id\":\"demo-part-${RUN_ID}\",
  \"type\":\"USER_PARTED\",
  \"eventData\":{
    \"id\":\"${STREAM_ID}\",
    \"timestamp\":\"2026-06-23T18:01:40.000Z\",
    \"user\":{\"id\":\"${VIEWER_ID}\"}
  }
}"
printf "\n"

echo "Mastodon campaign"
curl -sS "${BASE_URL}/mastodon/campaigns?locale=en&environment=test"
printf "\n\n"

echo "Mastodon donation"
json_post "/donate/${CAMPAIGN_ID}" "{
  \"viewerUserId\":\"demo-donor-${RUN_ID}\",
  \"walletAddress\":\"0xdonor\",
  \"amountUSDC\":\"2.50\"
}"
printf "\n"

echo "Ledger"
curl -sS "${BASE_URL}/ledger"
printf "\n"
