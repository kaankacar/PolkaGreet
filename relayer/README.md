# PolkaGreet Relayer

Self-hosted [OpenZeppelin Relayer](https://docs.openzeppelin.com/relayer) configured for Paseo Asset Hub. The relayer holds a funded wallet, exposes a REST API at `http://localhost:8080`, and submits `MetaTxRelayer.execute(req, sig)` calls on behalf of users so they don't need to hold native PAS to interact with PolkaGreet.

This replaces the previous setup where the relayer's private key was embedded in the React app — anyone could read it from devtools and drain the wallet.

## Architecture

```
Browser (signs EIP-712)
  │  POST /api/v1/relayers/polkagreet/transactions
  │  Authorization: Bearer <API_KEY>
  ▼
OpenZeppelin Relayer (Docker, port 8080)
  │  - Validates against whitelist_receivers policy
  │  - Decrypts local v3 keystore
  │  - Signs + submits transaction
  ▼
Paseo Asset Hub
  └─ MetaTxRelayer.execute(req, sig) → PolkaGreetContract.sayHi()
```

## Prerequisites

- Docker + Docker Compose
- Node.js 18+ (only used by the keystore generator)
- A funded EVM private key on Paseo Asset Hub

## Setup

```bash
cd relayer
cp .env.example .env
$EDITOR .env       # fill in API_KEY, WEBHOOK_SIGNING_KEY, KEYSTORE_PASSPHRASE, RELAYER_PRIVATE_KEY
./scripts/setup.sh # clones openzeppelin-relayer, builds the v3 keystore
docker compose up -d
```

`setup.sh` is idempotent — re-running it skips the clone and keystore steps when they already exist.

### Generating values for `.env`

```bash
# UUIDs for API_KEY and WEBHOOK_SIGNING_KEY
uuidgen
uuidgen

# Passphrase: 12+ chars with upper/lower/digit/special — example only:
#   KEYSTORE_PASSPHRASE='Polka!Greet#Relay9'
```

`RELAYER_PRIVATE_KEY` should be a freshly generated key funded with testnet PAS from the [Polkadot faucet](https://faucet.polkadot.io/?parachain=1111). Do **not** reuse the leaked key from the project's git history.

## Verifying the relayer is up

```bash
source .env
curl -H "Authorization: Bearer $API_KEY" http://localhost:8080/api/v1/relayers
```

You should see the `polkagreet` relayer with status info.

## Sending a meta-transaction by hand

```bash
source .env
curl -X POST \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "0x6fb6E63C01B68e9EDB719e26048aaA62A372Fb95",
    "value": 0,
    "data": "0x...execute(req,sig) calldata...",
    "gas_limit": 300000,
    "speed": "fast"
  }' \
  http://localhost:8080/api/v1/relayers/polkagreet/transactions
```

The frontend in `../frontend` does this automatically; see `frontend/.env.example` for the env vars it expects.

## Policies

`config/config.json` sets `whitelist_receivers` to the deployed `MetaTxRelayer` address (`0x6fb6E63C01B68e9EDB719e26048aaA62A372Fb95`). The relayer rejects transactions to any other contract, so a leaked API key can only be used to spam already-rate-limited calls into `MetaTxRelayer.execute()` — which itself rejects anything without a valid user EIP-712 signature.

For production you should also put an authenticated proxy in front of this relayer rather than embedding the API key in browser code; `whitelist_receivers` + the on-chain signature check are the second and third lines of defense.

## Files

- `docker-compose.yaml` — relayer + Redis services
- `config/config.json` — relayer + signer + policy definition
- `config/networks/paseo.json` — Paseo Asset Hub network definition
- `config/keys/local-signer.json` — generated v3 keystore (gitignored)
- `scripts/setup.sh` — idempotent provisioning
- `scripts/generate-keystore.js` — encrypts `RELAYER_PRIVATE_KEY` into the keystore
- `openzeppelin-relayer/` — clone of the upstream repo, used as the Docker build context (gitignored)
