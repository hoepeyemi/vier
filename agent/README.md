# vier Agent

The vier agent monitors the Flare Coston2 deployment, analyzes invoice and yield state, and can trigger on-chain strategy updates through `AgentRouter`.

## What the agent does

- Reads deployed contract state from Flare Coston2
- Analyzes invoice risk and due dates
- Decides between conservative and aggressive behavior
- Broadcasts live status to the frontend over WebSocket
- Can execute approved strategy changes on-chain

## Public deployment

The browser should connect to a public WebSocket endpoint, not localhost.

- Health endpoint: `/health`
- Default port: `8080`

## Quick start

```bash
cd agent
pnpm install
pnpm dev
```

## Docker

Build from the repo root:

```bash
docker build -f Dockerfile.mcp -t vier-agent .
```

Run the container:

```bash
docker run -p 8080:8080 --env-file .env.local vier-agent
```

## Required environment variables

```bash
COSTON2_RPC=https://coston2-api.flare.network/ext/C/rpc
WS_PORT=8080
DEPLOYMENT_NETWORK=coston2
INVOICE_NFT_ADDRESS=0x457310fA90dd419c86B09F4BDb97168A62e2370a
YIELD_VAULT_ADDRESS=0x6A5aaba21Ae401BeC7d60F076127d0F6AB46D43d
AGENT_ROUTER_ADDRESS=0x98DbA1d179b013342C2f63Ef551Cf72de4bb64e3
MOCK_ORACLE_ADDRESS=
PYTH_ORACLE_ADDRESS=0x7CfdF0580C87d0c379c4a5cDbC46A036E8AF71E3
AAVE_YIELD_ADDRESS=0x5a179d261fD322ecaED06FA9Aa2973980D74322c
AGENT_PRIVATE_KEY=0x...
QWEN_API_KEY=your-qwen-api-key
```

If you use the live deployment manifest, the agent can read the Flare Coston2 defaults from:

- [`contracts/deployments/coston2.json`](C:/Users/jwavo/vier/contracts/deployments/coston2.json)

## WebSocket API

- Server URL: `ws://localhost:8080` in local development
- Production should use `wss://` with a public domain

The agent broadcasts analysis, execution, and error messages to the frontend dashboard.

## Production notes

- The agent runs as a single Node.js process
- The Docker container exposes `/health`
- For production, keep `AGENT_PRIVATE_KEY` only on the server and never in the frontend
- Use a public agent URL in `NEXT_PUBLIC_AGENT_WS_URL`

## Deployment

See:

- [`agent/DEPLOYMENT.md`](C:/Users/jwavo/vier/agent/DEPLOYMENT.md)
- [`.github/workflows/ci.yml`](C:/Users/jwavo/vier/.github/workflows/ci.yml)
