# vier

> Autonomous AI treasury for B2B invoices on Flare Coston2

vier tokenizes invoices, evaluates risk with an agent, and records yield-management decisions on-chain. The production hackathon target is Flare Coston2 testnet with Flare Confidential Compute/FDC-ready hooks.

## Hackathon Status

- Smart contracts target Flare Coston2, chain ID `114`
- Deployment manifest is written to `contracts/deployments/coston2.json`
- Frontend defaults to Flare Coston2 in testnet mode
- Agent defaults to `DEPLOYMENT_NETWORK=coston2`
- RPC configuration supports dedicated QuickNode, NOWNodes, or Ankr endpoints, with public Coston2 fallbacks

## Deploy

```bash
# configure contracts/.env first
npm run deploy:coston2
```

Then copy the printed addresses or `contracts/deployments/coston2.json` values into the frontend/agent environment.

## Network

- Network: Flare Coston2
- Chain ID: `114`
- Native token symbol: `C2FLR`
- Explorer: https://coston2-explorer.flare.network
- Faucet: https://faucet.flare.network

## Production Checks

```bash
npm --prefix contracts run build
npm --prefix contracts run test
pnpm typecheck
pnpm lint
pnpm --filter vier-app build
pnpm --filter vier-agent build
pnpm --filter vier-agent test
```

## Workspaces

- `contracts/` - Hardhat workspace and Flare Coston2 deploy scripts
- `app/` - Next.js frontend configured for Coston2 testnet
- `agent/` - AI treasury agent with Coston2 deployment manifest loading