# Official Flare FCC Integration

vier now has two FCC paths:

1. Coston2 verified demo path: MockFDCVerifier verifies registered TEE signatures for encrypted invoice minting and agent strategy execution. This path is deployed and tested on Coston2.
2. Official FCC registry/proxy path: VierFCCInstructionSender follows Flare's official FCC scaffold by sending instructions through TeeExtensionRegistry to registered TEE machines selected from TeeMachineRegistry. The extension runtime is expected to be handled by Flare's extension-tee / ext-proxy stack.

## Official FCC Components Added

- contracts/src/fcc/interfaces/ITeeExtensionRegistry.sol
- contracts/src/fcc/interfaces/ITeeMachineRegistry.sol
- contracts/src/VierFCCInstructionSender.sol
- contracts/scripts/deploy-fcc-instruction-sender-coston2.js
- app/src/lib/fcc-official.ts

## Commands

Use FlareContractRegistry as the trusted source for official protocol addresses. The registry address is the same across Flare networks:

```bash
FLARE_CONTRACT_REGISTRY_ADDRESS=0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019
TEE_EXTENSION_REGISTRY_NAME=TeeExtensionRegistry
TEE_MACHINE_REGISTRY_NAME=TeeMachineRegistry
```

Current FCC docs also state that FCC registry addresses are temporarily read from the FCC scaffold `config/coston2/deployed-addresses.json` until the FCC contracts are published through `FlareContractRegistry`. If registry lookup returns `0x0000000000000000000000000000000000000000`, copy those temporary FCC addresses into:

```bash
TEE_EXTENSION_REGISTRY_ADDRESS=0x...
TEE_MACHINE_REGISTRY_ADDRESS=0x...
```

Deploy the sender:

```bash
cd contracts
pnpm run deploy:fcc-sender:coston2
```

The deploy script is registry-first: it resolves TeeExtensionRegistry and TeeMachineRegistry through FlareContractRegistry. While FCC is still in development, Flare may require the temporary `TEE_EXTENSION_REGISTRY_ADDRESS` and `TEE_MACHINE_REGISTRY_ADDRESS` overrides from the FCC scaffold `config/coston2/deployed-addresses.json`. Register the sender in TeeExtensionRegistry, then call:

```bash
cast send $FCC_INSTRUCTION_SENDER_ADDRESS "setExtensionId()" --rpc-url $COSTON2_RPC --private-key $PRIVATE_KEY
```

Run the official extension stack with:

```bash
FCC_EXT_PROXY_URL=http://localhost:<ext-proxy-port>
EXT_PROXY_URL=http://localhost:<ext-proxy-port>
NORMAL_PROXY_URL=https://tee-proxy-coston2-1.flare.rocks
LOCAL_MODE=false
SIMULATED_TEE=true
```


## Coston2 FCC Deployment

Official FCC scaffold Coston2 address source: `flare-foundation/fce-extension-scaffold/config/coston2/deployed-addresses.json`.

The scaffold binds both FCC interfaces to the `FlareTeeManager` diamond proxy:

```bash
FLARE_TEE_MANAGER_ADDRESS=0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE
TEE_EXTENSION_REGISTRY_ADDRESS=0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE
TEE_MACHINE_REGISTRY_ADDRESS=0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE
FCC_INSTRUCTION_SENDER_ADDRESS=0x6Aa62B3979D4cdc6E3A84772d66dC45adA047CaB
```

Verified InstructionSender:
https://coston2-explorer.flare.network/address/0x6Aa62B3979D4cdc6E3A84772d66dC45adA047CaB#code

## vier Operations

VierFCCInstructionSender exposes:

- sendEncryptedMintInstruction(bytes message) with command ATTEST_MINT
- sendStrategyAnalysisInstruction(bytes message) with command ANALYZE_STRATEGY

The extension-tee handler should parse those messages, perform confidential computation, and return or verifiably submit results to the existing Coston2 contracts.

## Claim Language

Use this wording only after the official registry addresses are configured, the sender is deployed and registered, setExtensionId() succeeds, and the extension-tee/ext-proxy service is running:

> vier integrates with Flare FCC's official registry/proxy architecture via a dedicated InstructionSender that routes encrypted invoice mint and strategy-analysis instructions through TeeExtensionRegistry/TeeMachineRegistry to the FCC extension runtime, while retaining a verified Coston2 MockFDC fallback for demos.

Do not claim "official production FCC" unless Flare has opened production FCC access for your deployment and the sender is registered against the official production FCC infrastructure.