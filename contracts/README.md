# vier Contracts

Hardhat workspace for the vier protocol contracts on Flare Coston2.

## What is deployed

The live deployment is on Flare Coston2 and the deployed addresses are recorded in:

- [`contracts/deployments/coston2.json`](C:/Users/jwavo/vier/contracts/deployments/coston2.json)

## Deployed and verified contracts

Chain ID: `114`

| Contract | Address | Explorer status |
| --- | --- | --- |
| InvoiceNFT | `0x457310fA90dd419c86B09F4BDb97168A62e2370a` | Verified |
| YieldVault | `0x6A5aaba21Ae401BeC7d60F076127d0F6AB46D43d` | Verified |
| AgentRouter | `0x98DbA1d179b013342C2f63Ef551Cf72de4bb64e3` | Verified |
| PrivacyRegistry | `0x273530115B355a040735B06b308f3aa9cFa4e451` | Verified |
| MockOracle | `0xd4DE5d9DC3fFd4c728dE13aaE57C74628cd441b5` | Verified |
| MockFDCVerifier | `0x827f01e7c3111cbB7b690E12B365eC0E14b144f6` | Verified |
| VierFCCInstructionSender | `0x6Aa62B3979D4cdc6E3A84772d66dC45adA047CaB` | Verified |

Explorer:
- [Flare Coston2 Explorer](https://coston2-explorer.flare.network)

## Contract overview

- `InvoiceNFT` - invoice tokenization and privacy commitments
- `YieldVault` - deposit and yield management
- `AgentRouter` - records and executes AI-driven strategy decisions
- `PrivacyRegistry` - selective disclosure registry
- `MockOracle` - Coston2 demo invoice risk oracle
- `MockFDCVerifier` - Coston2 demo verifier for FCC-style attestations
- `VierFCCInstructionSender` - official FCC registry/proxy-compatible instruction sender
- `AaveV3YieldSource` - optional adapter for a real Aave V3 pool on networks where one exists

## Setup

```bash
cd contracts
pnpm install
pnpm run build
pnpm test
```

## Deployment

### Flare Coston2

```bash
pnpm run deploy:coston2
```

This deployment flow uses Flare Coston2 RPC fallbacks and writes `deployments/coston2.json` as the canonical manifest.

### Local network

```bash
pnpm run deploy:local
```

### Production-ready factory

`VierFactory` can atomically deploy and wire the protocol stack without embedding child contract creation bytecode in its own runtime. Deployment scripts pass audited artifact bytecode as calldata, which keeps the factory below the production contract-size limit while preserving one-transaction protocol deployment and ownership transfer.

## Verification

The repo includes a programmatic verifier for the live Flare Coston2 deployment:

```bash
pnpm run verify:coston2
```

Required environment variable:

```bash
ETHERSCAN_API_KEY=your_api_key_here
```

## Architecture

```text
InvoiceNFT -> YieldVault -> AgentRouter
      |             |
  MockOracle   optional AaveV3YieldSource
      |
MockFDCVerifier + VierFCCInstructionSender
```

## Notes

- The live Flare Coston2 contracts are verified on Coston2 Explorer.
- Flare FTSOv2 market prices are read by the agent runtime.
- The deployment manifest is the canonical source of truth for the app and agent.
- If you redeploy any contract, update the deployment manifest and the frontend/agent env values together.