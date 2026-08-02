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
NEXT_PUBLIC_INVOICE_NFT_ADDRESS=0x457310fA90dd419c86B09F4BDb97168A62e2370a
NEXT_PUBLIC_YIELD_VAULT_ADDRESS=0x6A5aaba21Ae401BeC7d60F076127d0F6AB46D43d
NEXT_PUBLIC_AGENT_ROUTER_ADDRESS=0x98DbA1d179b013342C2f63Ef551Cf72de4bb64e3
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
