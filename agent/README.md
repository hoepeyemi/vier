# vier Agent

The vier agent monitors the Flare Coston2 deployment, analyzes invoice and yield state, and can trigger on-chain strategy updates through `AgentRouter`.

## What the agent does

- Reads deployed contract state from Flare Coston2
- Analyzes invoice risk and due dates via FTSOv2-powered FtsoOracle
- Decides between conservative and aggressive behavior using Qwen AI
- Broadcasts live status to the frontend over WebSocket
- Executes approved strategy changes on-chain via `AgentRouter` (FCE TEE mode)

## Public deployment

The browser connects to a public WebSocket endpoint, not localhost.

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
INVOICE_NFT_ADDRESS=0x7481aeE59C35bb08c4F4B0DC4DE0C0A143c9d7b7
YIELD_VAULT_ADDRESS=0xfDa39D8a75391aAec43BB54a774bf6F03A0033b6
AGENT_ROUTER_ADDRESS=0x95116249980028E240403477E41dF44e12968AC5
FTSO_ORACLE_ADDRESS=0xCc351f611b89607e25ab124D3abF58A83ADf94a9
MOCK_ORACLE_ADDRESS=
AGENT_PRIVATE_KEY=0x...
QWEN_API_KEY=your-qwen-api-key
```

If you use the live deployment manifest, the agent reads Flare Coston2 defaults from:

- [`contracts/deployments/coston2.json`](../contracts/deployments/coston2.json)

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

- [`agent/DEPLOYMENT.md`](DEPLOYMENT.md)
- [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)
