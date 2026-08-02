# Deploying vier to Flare Coston2

This guide is the production deployment path for the Flare FCC hackathon build. The contract target is Flare Coston2 testnet, chain ID `114`, using `C2FLR` for gas.

## 1. Configure RPC and Wallet

Create or update `contracts/.env`:

```bash
PRIVATE_KEY=0xyour_deployer_private_key
COSTON2_RPC=https://coston2-api.flare.network/ext/C/rpc
```

For production traffic, prefer a dedicated endpoint from QuickNode, NOWNodes, or Ankr. Public Coston2 RPCs are also discoverable from ChainList chain `114`.

Fund the deployer with Coston2 test tokens from the Flare faucet:

```text
https://faucet.flare.network
```

## 2. Deploy Contracts

```bash
npm run deploy:coston2
```

The deploy script writes the canonical manifest to:

```text
contracts/deployments/coston2.json
```

That manifest is what the agent reads by default when `DEPLOYMENT_NETWORK=coston2`.

## 3. Configure the Agent

Create `agent/.env`:

```bash
DEPLOYMENT_NETWORK=coston2
CHAIN_RPC_URL=https://coston2-api.flare.network/ext/C/rpc
COSTON2_RPC=https://coston2-api.flare.network/ext/C/rpc
WS_PORT=8080
FCE_TEE_MODE=true
FLARE_TEE_ID=<teeId printed by deploy-coston2>
AGENT_PRIVATE_KEY=0xyour_agent_private_key
QWEN_API_KEY=<optional>
```

The agent auto-loads `invoiceNFT`, `yieldVault`, `agentRouter`, `privacyRegistry`, and oracle addresses from `contracts/deployments/coston2.json`. Explicit env vars can still override those values for hosted deployments.

## 4. Configure the Frontend

Set the app environment from the same manifest. The frontend FCC mint endpoint also requires `FLARE_FCE_IDENTITY_KEY`, `FLARE_TEE_ID`, `FCE_IMAGE_HASH`, and `FLARE_CHAIN_ID` on the server runtime; never expose these with `NEXT_PUBLIC_` prefixes.

```bash
NEXT_PUBLIC_NETWORK_MODE=testnet
NEXT_PUBLIC_CHAIN_ID=114
NEXT_PUBLIC_COSTON2_RPC=https://coston2-api.flare.network/ext/C/rpc
NEXT_PUBLIC_AGENT_WS_URL=wss://<your-agent-host>
NEXT_PUBLIC_COSTON2_INVOICE_NFT=0x7481aeE59C35bb08c4F4B0DC4DE0C0A143c9d7b7
NEXT_PUBLIC_COSTON2_YIELD_VAULT=0xfDa39D8a75391aAec43BB54a774bf6F03A0033b6
NEXT_PUBLIC_COSTON2_AGENT_ROUTER=0x95116249980028E240403477E41dF44e12968AC5
NEXT_PUBLIC_COSTON2_PRIVACY_REGISTRY=0xc08B41ACeD118665d08b9517c812db483245791C
NEXT_PUBLIC_COSTON2_FTSO_ORACLE=0xCc351f611b89607e25ab124D3abF58A83ADf94a9
```

## 5. Production Checks

Before submission or public demos, run:

```bash
npm --prefix contracts run build
npm --prefix contracts run test
pnpm typecheck
pnpm lint
pnpm --filter vier-app build
pnpm --filter vier-agent build
pnpm --filter vier-agent test
```

## Useful Links

- Coston2 Explorer: https://coston2-explorer.flare.network
- Flare faucet: https://faucet.flare.network
- QuickNode Flare RPC: https://www.quicknode.com/chains/flare
- NOWNodes: https://nownodes.io/
- Ankr Flare RPC: https://www.ankr.com/rpc/flare/
- ChainList chain 114: https://chainlist.org/chain/114