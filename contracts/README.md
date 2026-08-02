# vier Contracts

Hardhat workspace for the vier protocol contracts on Flare Coston2.

## What is deployed

The live deployment is on Flare Coston2 and the deployed addresses are recorded in:

- [`contracts/deployments/coston2.json`](C:/Users/jwavo/vier/contracts/deployments/coston2.json)

## Deployed and verified contracts

Chain ID: `114`

| Contract | Address | Explorer status |
| --- | --- | --- |
| InvoiceNFT | `0x7481aeE59C35bb08c4F4B0DC4DE0C0A143c9d7b7` | Pending |
| YieldVault | `0xfDa39D8a75391aAec43BB54a774bf6F03A0033b6` | Pending |
| AgentRouter | `0x95116249980028E240403477E41dF44e12968AC5` | Pending |
| PrivacyRegistry | `0xc08B41ACeD118665d08b9517c812db483245791C` | Pending |
| FtsoOracle | `0xCc351f611b89607e25ab124D3abF58A83ADf94a9` | Pending |
| MockFDCVerifier | `0x4FE685b35c3A1B9b297eF7D1465C49b5d859daE9` | Pending |
| VierFCCInstructionSender | `0x6Aa62B3979D4cdc6E3A84772d66dC45adA047CaB` | Verified |

Explorer:
- [Flare Coston2 Explorer](https://coston2-explorer.flare.network)

## Contract overview

- `InvoiceNFT` - invoice tokenization and privacy commitments
- `YieldVault` - deposit and yield management
- `AgentRouter` - records and executes AI-driven strategy decisions
- `PrivacyRegistry` - selective disclosure registry
- `FtsoOracle` - Coston2 FTSOv2-powered invoice risk oracle (resolves FtsoV2 via FlareContractRegistry)
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