#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "ERROR: .env not found. Copy .env.example to .env and fill it in first." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
. ./.env
set +a

: "${API_KEY:?API_KEY missing in .env}"
: "${WEBHOOK_SIGNING_KEY:?WEBHOOK_SIGNING_KEY missing in .env}"
: "${KEYSTORE_PASSPHRASE:?KEYSTORE_PASSPHRASE missing in .env}"
: "${RELAYER_PRIVATE_KEY:?RELAYER_PRIVATE_KEY missing in .env}"

if [ ! -d openzeppelin-relayer ]; then
  echo "Cloning OpenZeppelin Relayer..."
  git clone --depth 1 --branch v1.4.0 \
    https://github.com/OpenZeppelin/openzeppelin-relayer.git openzeppelin-relayer
fi

if [ ! -d node_modules ]; then
  echo "Installing keystore-generator dependencies..."
  npm install --no-audit --no-fund --silent
fi

if [ ! -f config/keys/local-signer.json ]; then
  echo "Generating v3 keystore..."
  node scripts/generate-keystore.js
fi

echo
echo "Setup complete."
echo "  - Config:    relayer/config/config.json"
echo "  - Networks:  relayer/config/networks/paseo.json"
echo "  - Keystore:  relayer/config/keys/local-signer.json"
echo
echo "Next:"
echo "  cd relayer && docker compose up -d"
echo "  curl -H \"Authorization: Bearer \$API_KEY\" http://localhost:8080/api/v1/relayers"
