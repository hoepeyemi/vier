// Flare Confidential Compute (FCC) — TEE Payload Signer
//
// In production, the Flare FCE infrastructure injects FLARE_FCE_IDENTITY_KEY
// into the TEE at runtime. This module uses that key (or falls back to
// AGENT_PRIVATE_KEY for demo/testnet) to sign decision payloads before
// submitting them to AgentRouter.executeStrategyWithAttestation().
//
// The on-chain flow:
//   1. Agent decides on a strategy inside the TEE
//   2. This module encodes + signs the decision payload
//   3. Agent calls AgentRouter.executeStrategyWithAttestation(teeId, payload, sig)
//   4. AgentRouter asks MockFDCVerifier.verifyAttestation() → checks ECDSA sig
//   5. On success: strategy executes + PrivacyRegistry.logTEEStrategyChange() called

import { ethers } from 'ethers';

// Seed for the TEE identity hash. In production this is the reproducible Docker
// image digest (sha256 of Dockerfile.fce build output).
const FCE_IMAGE_HASH =
  process.env.FCE_IMAGE_HASH ||
  '0x7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069';

const FLARE_CHAIN_ID = BigInt(process.env.FLARE_CHAIN_ID || '114');

export interface SignedAttestation {
  teeId: string;     // bytes32 hex — TEE machine identity
  payload: string;   // bytes hex — ABI-encoded TeeDecisionPayload
  signature: string; // bytes hex — ECDSA sig over keccak256(teeId || payload)
}

export class TEESigner {
  private wallet: ethers.Wallet;
  readonly teeId: string;
  // Seeded from Date.now() so nonces never collide across agent restarts.
  // On-chain: usedNonces[teeId][nonce] rejects duplicates, so nonce 0 being
  // submitted again after a restart would be permanently rejected.
  private nonce: number;

  constructor(agentPrivateKey: string) {
    // In real Flare FCC: FLARE_FCE_IDENTITY_KEY is injected at runtime.
    // For testnet demo: fall back to the agent's wallet key.
    const signingKey = process.env.FLARE_FCE_IDENTITY_KEY || agentPrivateKey;
    this.wallet = new ethers.Wallet(signingKey);

    // teeId can be overridden by env (set by deploy-coston2.js output) or computed.
    this.teeId =
      process.env.FLARE_TEE_ID ||
      ethers.keccak256(
        ethers.solidityPacked(
          ['bytes32', 'uint256'],
          [FCE_IMAGE_HASH, FLARE_CHAIN_ID]
        )
      );

    // Start nonce from current timestamp (ms) — always greater than any nonce
    // used in a previous session, preventing "nonce already used" reverts after restart.
    this.nonce = Date.now();
  }

  getSignerAddress(): string {
    return this.wallet.address;
  }

  getTeeId(): string {
    return this.teeId;
  }

  // Must match abi.decode(...) in AgentRouter.executeStrategyWithAttestation:
  //   (uint256 tokenId, uint8 strategy, uint256 confidence, string reasoning, uint256 nonce, uint256 timestamp)
  encodePayload(
    tokenId: string,
    strategy: number,
    confidence: number,
    reasoning: string
  ): string {
    return ethers.AbiCoder.defaultAbiCoder().encode(
      ['uint256', 'uint8', 'uint256', 'string', 'uint256', 'uint256'],
      [
        BigInt(tokenId),
        strategy,
        BigInt(confidence),
        reasoning,
        BigInt(this.nonce++),
        BigInt(Math.floor(Date.now() / 1000)),
      ]
    );
  }

  async signPayload(teeId: string, payload: string): Promise<string> {
    // Matches MockFDCVerifier.verifyAttestation:
    //   keccak256(abi.encodePacked(teeId, payload))  → eth_sign
    const msgHash = ethers.keccak256(
      ethers.solidityPacked(['bytes32', 'bytes'], [teeId, payload])
    );
    // ethers.Wallet.signMessage() prepends the Ethereum prefix → matches _recover() in MockFDCVerifier
    return this.wallet.signMessage(ethers.getBytes(msgHash));
  }

  async createAttestation(
    tokenId: string,
    strategy: number,
    confidence: number,
    reasoning: string
  ): Promise<SignedAttestation> {
    const payload = this.encodePayload(tokenId, strategy, confidence, reasoning);
    const signature = await this.signPayload(this.teeId, payload);
    return { teeId: this.teeId, payload, signature };
  }
}
