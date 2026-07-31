# vier Contracts

Hardhat workspace for the vier protocol contracts on Flare Coston2.

## What is deployed

The live deployment is on Flare Coston2 and the deployed addresses are recorded in:

- [`contracts/deployments/coston2.json`](C:/Users/jwavo/vier/contracts/deployments/coston2.json)

## Deployed and verified contracts

Chain ID: `114`

| Contract | Address | Explorer status |
| --- | --- | --- |
| InvoiceNFT | `0x018ee8F363421016177DbC8F9492fe2a1C720e29` | Verified |
| YieldVault | `0x7f51D3B234E4c20959A1f6e91D3B852EE16c65A6` | Verified |
| AgentRouter | `0x4430248F3b2304F946f08c43A06C3451657FD658` | Verified |
| PrivacyRegistry | `0x2DA4B52913A928263a405dE3b42a5768a4dCa3b0` | Verified |
| PythOracle | `0x7CfdF0580C87d0c379c4a5cDbC46A036E8AF71E3` | Verified |
| AaveV3YieldSource | `0x5a179d261fD322ecaED06FA9Aa2973980D74322c` | Verified |

Explorer:
- [Flare Coston2 Explorer](https://coston2-explorer.flare.network)

## Contract overview

- `InvoiceNFT` - invoice tokenization and privacy commitments
- `YieldVault` - deposit and yield management
- `AgentRouter` - records and executes AI-driven strategy decisions
- `PrivacyRegistry` - selective disclosure registry
- `PythOracle` - Flare Coston2 oracle integration
- `AaveV3YieldSource` - yield source integration for the deployed flow

## Setup

```bash
cd contracts
npm install
npm run build
npm test
```

## Deployment

### Flare Coston2

```bash
npm run deploy:coston2
```

This deployment flow uses the built-in Flare Coston2 RPC fallbacks and the live oracle and yield source defaults.

### Local network

```bash
npm run deploy:local
```

### Production-ready factory

`VierFactory` can atomically deploy and wire the protocol stack without embedding child contract creation bytecode in its own runtime. Deployment scripts pass audited artifact bytecode as calldata, which keeps the factory below the production contract-size limit while preserving one-transaction protocol deployment and ownership transfer.

## Verification

The repo includes a programmatic verifier for the live Flare Coston2 deployment:

```bash
npm run verify:coston2
```

Required environment variable:

```bash
ETHERSCAN_API_KEY=your_api_key_here
```

The verifier checks:

- `InvoiceNFT`
- `YieldVault`
- `AgentRouter`
- `PrivacyRegistry`
- `PythOracle`
- `AaveV3YieldSource`

## Architecture

```text
InvoiceNFT -> YieldVault -> AgentRouter
      |             |
   PythOracle   AaveV3YieldSource
```

## Notes

- The live Flare Coston2 contracts are verified on Coston2 Explorer.
- The deployment manifest is the canonical source of truth for the app and agent.
- If you redeploy any contract, update the deployment manifest and the frontend/agent env values together.

