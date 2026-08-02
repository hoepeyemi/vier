# vier - Progress

## Current State (2026-08-02)
Deployed to Flare Coston2. FTSOv2-powered oracle stack live. Agent runs with FtsoOracle + Qwen analysis inside Flare FCC (Confidential Compute).

## Verified Working

### On-chain (Flare Coston2, chain 114)
- **Mint**: InvoiceNFT FCC-attested mint (FDC attestation verified on-chain before minting)
- **Risk**: FtsoOracle reads live FLR/USD from FTSOv2 via FlareContractRegistry, writes riskScore/paymentProbability to InvoiceNFT
- **Yield**: YieldVault deposit/withdraw with accrued yield
- **Strategy**: AgentRouter TEE-attested strategy execution (FCE TEE mode enabled)
- **Privacy**: PrivacyRegistry stores encrypted invoice commitments, selective disclosure via TEE
- **All contracts wired**: InvoiceNFT <-> YieldVault <-> AgentRouter <-> FtsoOracle confirmed

### Agent
- Connects to Flare Coston2, reads contracts via FlareContractRegistry
- FtsoOracle: calls assessAndUpdateRisk(tokenId) before each analysis — live FTSOv2 price → on-chain risk score
- FTSOv2: dynamic resolution via FlareContractRegistry.getContractAddressByName("FtsoV2")
- Qwen: real AI analysis (not templates)
- FCE TEE mode: TEE-signed payloads, FDC attestation on AgentRouter
- 37 tests passing

### Frontend
- Landing page: Flare Coston2 branding, FCC stats
- Dashboard: portfolio from on-chain data
- Agent page: live FTSOv2 oracle status
- Mint: FCC-attested encrypted invoice commitment

## Deployed Addresses (Flare Coston2, 2026-08-02)
```
InvoiceNFT:      0x7481aeE59C35bb08c4F4B0DC4DE0C0A143c9d7b7
YieldVault:      0xfDa39D8a75391aAec43BB54a774bf6F03A0033b6
PrivacyRegistry: 0xc08B41ACeD118665d08b9517c812db483245791C
AgentRouter:     0x95116249980028E240403477E41dF44e12968AC5
MockFDCVerifier: 0x4FE685b35c3A1B9b297eF7D1465C49b5d859daE9
FtsoOracle:      0xCc351f611b89607e25ab124D3abF58A83ADf94a9
FtsoV2:          0xC4e9c78EA53db782E28f28Fdf80BaF59336B304d (registry-resolved)
FlareContractRegistry: 0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019
```

## Deployer Wallet
Address: 0x9404966338eB27aF420a952574d777598Bbb58c4
Balance: ~84 C2FLR (Flare Coston2)
