# vier Frontend

Next.js frontend for vier, built for Flare Coston2 and ready for public deployment.

## What this app does

- Mints invoice NFTs
- Shows portfolio and invoice detail pages
- Connects to the AI agent over WebSocket
- Supports issuer and privacy controls
- Displays deployed Flare Coston2 addresses

## Public deployment

The frontend is configured to be publicly accessible and not localhost-only.

- Live demo: [https://vasno.netlify.app/](https://vasno.netlify.app/)
- Health endpoint: `/health`

Set the public URL in production with `NEXT_PUBLIC_APP_URL`.

## Local development

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

## Environment variables

Required for the live Flare Coston2 app:

```bash
NEXT_PUBLIC_CHAIN_ID=114
NEXT_PUBLIC_NETWORK_MODE=testnet
NEXT_PUBLIC_INVOICE_NFT_ADDRESS=0x018ee8F363421016177DbC8F9492fe2a1C720e29
NEXT_PUBLIC_YIELD_VAULT_ADDRESS=0x7f51D3B234E4c20959A1f6e91D3B852EE16c65A6
NEXT_PUBLIC_AGENT_ROUTER_ADDRESS=0x4430248F3b2304F946f08c43A06C3451657FD658
NEXT_PUBLIC_PRIVACY_REGISTRY_ADDRESS=0x2DA4B52913A928263a405dE3b42a5768a4dCa3b0
NEXT_PUBLIC_MOCK_ORACLE_ADDRESS=
NEXT_PUBLIC_AGENT_WS_URL=wss://your-public-agent-domain
NEXT_PUBLIC_APP_URL=https://your-public-web-domain
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your-project-id
NEXT_PUBLIC_COSTON2_RPC=https://coston2-api.flare.network/ext/C/rpc
NEXT_PUBLIC_COSTON2_RPC_FALLBACK_1=https://coston2.enosys.global/ext/C/rpc
NEXT_PUBLIC_COSTON2_RPC_FALLBACK_2=https://coston2-api.flare.network/ext/C/rpc
```

Flare Coston2 RPC fallbacks:

```bash
NEXT_PUBLIC_COSTON2_RPC=https://coston2-api.flare.network/ext/C/rpc
NEXT_PUBLIC_COSTON2_RPC_FALLBACK_1=https://coston2.enosys.global/ext/C/rpc
NEXT_PUBLIC_COSTON2_RPC_FALLBACK_2=https://coston2-api.flare.network/ext/C/rpc
```

## Build and scripts

```bash
pnpm dev
pnpm build
pnpm lint
pnpm tsc
```

## Notes

- QuickBooks uses a demo fallback when OAuth is not configured.
- The app is designed around the live Flare Coston2 deployment manifest in `contracts/deployments/coston2.json`.
- If you change contract addresses, update the deployment manifest and the public env values together.
