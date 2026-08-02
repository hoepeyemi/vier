// Flare Confidential Compute (FCC) Ã¢â‚¬â€ TEE Attestation Tests
//
// Covers the full end-to-end flow:
//   TEE signs payload Ã¢â€ â€™ MockFDCVerifier verifies ECDSA Ã¢â€ â€™ AgentRouter executes
//   strategy Ã¢â€ â€™ PrivacyRegistry records immutable audit entry
//
// These tests prove the FCC integration is correct before deploying to Coston2.

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployCoreContracts, increaseTime } = require("./helpers");

// Ã¢â€â‚¬Ã¢â€â‚¬ Fixtures Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

async function deployFCCContracts() {
  const base = await deployCoreContracts();

  const MockFDCVerifier = await ethers.getContractFactory("MockFDCVerifier");
  const mockFDC = await MockFDCVerifier.deploy();
  await mockFDC.waitForDeployment();

  // TEE signer wallet Ã¢â‚¬â€ in production this is the Flare FCE identity key
  const teeSigner = ethers.Wallet.createRandom();

  // teeId = keccak256(imageHash || chainId)  Ã¢â‚¬â€ mirrors tee-signer.ts
  const imageHash = ethers.keccak256(ethers.toUtf8Bytes("vier-fce-v1-test"));
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const teeId = ethers.keccak256(
    ethers.solidityPacked(["bytes32", "uint256"], [imageHash, chainId])
  );

  // Register TEE with MockFDCVerifier
  await mockFDC.registerTEE(teeId, teeSigner.address);

  // Wire AgentRouter with FCC
  const agentRouterAddr = await base.agentRouter.getAddress();
  await base.agentRouter.setFDCVerifier(await mockFDC.getAddress());
  await base.agentRouter.setPrivacyRegistry(await base.privacyRegistry.getAddress());
  await base.agentRouter.setTEEAttestationMode(true);
  await base.agentRouter.setDecisionCooldown(0);

  // Authorize AgentRouter to append TEE audit entries
  await base.privacyRegistry.addAuthorizedRouter(agentRouterAddr);

  return { ...base, mockFDC, teeSigner, teeId };
}

// Matches the ABI encoding in tee-signer.ts and the abi.decode in AgentRouter.sol.
// Uses the Hardhat block timestamp (not wall-clock time) so tests remain valid even
// after other test files have called evm_increaseTime.
async function createAttestation(teeSigner, teeId, tokenId, strategy, confidence, reasoning, nonce) {
  const block = await ethers.provider.getBlock("latest");
  const payload = ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint256", "uint8", "uint256", "string", "uint256", "uint256"],
    [
      BigInt(tokenId),
      strategy,
      BigInt(confidence),
      reasoning,
      BigInt(nonce),
      BigInt(block.timestamp),
    ]
  );

  // Matches MockFDCVerifier: keccak256(abi.encodePacked(teeId, payload))
  const msgHash = ethers.keccak256(
    ethers.solidityPacked(["bytes32", "bytes"], [teeId, payload])
  );

  // Wallet.signMessage prepends the Ethereum prefix Ã¢â‚¬â€ matches MockFDCVerifier._recover
  const signature = await teeSigner.signMessage(ethers.getBytes(msgHash));

  return { payload, signature };
}


async function createMintAttestation(teeSigner, teeId, issuer, dataCommitment, amountCommitment, encryptedInvoiceHash, dueDate, nonce) {
  const block = await ethers.provider.getBlock("latest");
  const payload = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "bytes32", "bytes32", "bytes32", "uint256", "uint256", "uint256"],
    [issuer.address, dataCommitment, amountCommitment, encryptedInvoiceHash, BigInt(dueDate), BigInt(nonce), BigInt(block.timestamp)]
  );
  const msgHash = ethers.keccak256(ethers.solidityPacked(["bytes32", "bytes"], [teeId, payload]));
  const signature = await teeSigner.signMessage(ethers.getBytes(msgHash));
  return { payload, signature };
}
async function mintAndDeposit(user, invoiceNFT, yieldVault, strategy = 0) {
  const dataCommitment = ethers.keccak256(ethers.randomBytes(32));
  const now = (await ethers.provider.getBlock("latest")).timestamp;
  const dueDate = now + 86400 * 90;

  await invoiceNFT.connect(user).mint(dataCommitment, dataCommitment, dueDate);
  const tokenId = (await invoiceNFT.totalInvoices()) - 1n;
  await invoiceNFT.connect(user).approve(await yieldVault.getAddress(), tokenId);
  await yieldVault.connect(user).deposit(tokenId, strategy, ethers.parseEther("10000"));
  return tokenId;
}

// Ã¢â€â‚¬Ã¢â€â‚¬ Tests Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

describe("MockFDCVerifier", function () {
  it("registers and queries a TEE", async function () {
    const { mockFDC, teeSigner, teeId } = await deployFCCContracts();

    expect(await mockFDC.isTEERegistered(teeId)).to.equal(true);
    expect(await mockFDC.teeSigners(teeId)).to.equal(teeSigner.address);
  });

  it("verifyAttestation returns true for a valid signature", async function () {
    const { mockFDC, teeSigner, teeId } = await deployFCCContracts();

    const payload = ethers.AbiCoder.defaultAbiCoder().encode(["string"], ["test"]);
    const msgHash = ethers.keccak256(ethers.solidityPacked(["bytes32", "bytes"], [teeId, payload]));
    const sig = await teeSigner.signMessage(ethers.getBytes(msgHash));

    expect(await mockFDC.verifyAttestation(teeId, payload, sig)).to.equal(true);
  });

  it("verifyAttestation returns false for wrong signer", async function () {
    const { mockFDC, teeId } = await deployFCCContracts();

    const payload = ethers.AbiCoder.defaultAbiCoder().encode(["string"], ["test"]);
    const msgHash = ethers.keccak256(ethers.solidityPacked(["bytes32", "bytes"], [teeId, payload]));
    const badSig = await ethers.Wallet.createRandom().signMessage(ethers.getBytes(msgHash));

    expect(await mockFDC.verifyAttestation(teeId, payload, badSig)).to.equal(false);
  });

  it("verifyAttestation returns false for unregistered teeId", async function () {
    const { mockFDC, teeSigner } = await deployFCCContracts();

    const fakeTeeId = ethers.keccak256(ethers.toUtf8Bytes("not-registered"));
    const payload = ethers.AbiCoder.defaultAbiCoder().encode(["string"], ["test"]);
    const msgHash = ethers.keccak256(ethers.solidityPacked(["bytes32", "bytes"], [fakeTeeId, payload]));
    const sig = await teeSigner.signMessage(ethers.getBytes(msgHash));

    expect(await mockFDC.verifyAttestation(fakeTeeId, payload, sig)).to.equal(false);
  });

  it("owner can deregister a TEE", async function () {
    const { mockFDC, teeId } = await deployFCCContracts();

    await mockFDC.deregisterTEE(teeId);
    expect(await mockFDC.isTEERegistered(teeId)).to.equal(false);
  });

  it("non-owner cannot register a TEE", async function () {
    const { mockFDC, user1 } = await deployFCCContracts();

    const fakeTeeId = ethers.keccak256(ethers.toUtf8Bytes("attacker-tee"));
    await expect(
      mockFDC.connect(user1).registerTEE(fakeTeeId, user1.address)
    ).to.be.revertedWith("MockFDCVerifier: not owner");
  });
});

describe("AgentRouter Ã¢â‚¬â€ FCC TEE attestation mode", function () {
  it("end-to-end: executes strategy change via valid TEE attestation", async function () {
    const { user1, invoiceNFT, yieldVault, agentRouter, teeSigner, teeId } =
      await deployFCCContracts();

    const tokenId = await mintAndDeposit(user1, invoiceNFT, yieldVault, 0); // Hold

    const { payload, signature } = await createAttestation(
      teeSigner, teeId, tokenId, 2, 85, "Long duration Ã¢â‚¬â€ aggressive yield recommended", Date.now()
    );

    const tx = await agentRouter.executeStrategyWithAttestation(teeId, payload, signature);
    const receipt = await tx.wait();

    // TEEAttestationVerified event was emitted
    const events = receipt.logs
      .map(l => { try { return agentRouter.interface.parseLog(l); } catch { return null; } })
      .filter(Boolean);

    const attested = events.find(e => e.name === "TEEAttestationVerified");
    expect(attested).to.not.be.undefined;
    expect(attested.args.teeId).to.equal(teeId);
    expect(attested.args.tokenId).to.equal(tokenId);
    expect(attested.args.strategy).to.equal(2n); // Aggressive

    // Strategy actually changed in YieldVault
    const deposit = await yieldVault.getDeposit(tokenId);
    expect(deposit.strategy).to.equal(2n);
  });

  it("rejects replayed (already-used) nonces", async function () {
    const { user1, invoiceNFT, yieldVault, agentRouter, teeSigner, teeId } =
      await deployFCCContracts();

    const tokenId = await mintAndDeposit(user1, invoiceNFT, yieldVault, 0);
    const nonce = Date.now();

    const { payload, signature } = await createAttestation(
      teeSigner, teeId, tokenId, 1, 80, "Conservative", nonce
    );

    // First submission succeeds
    await agentRouter.executeStrategyWithAttestation(teeId, payload, signature);

    // Exact same payload replayed Ã¢â‚¬â€ must revert
    await expect(
      agentRouter.executeStrategyWithAttestation(teeId, payload, signature)
    ).to.be.revertedWith("AgentRouter: nonce already used");
  });

  it("rejects payloads signed by an unauthorized wallet", async function () {
    const { user1, invoiceNFT, yieldVault, agentRouter, teeId } =
      await deployFCCContracts();

    const tokenId = await mintAndDeposit(user1, invoiceNFT, yieldVault, 0);

    const payload = ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256", "uint8", "uint256", "string", "uint256", "uint256"],
      [tokenId, 1, 80n, "Unauthorized", BigInt(Date.now()), BigInt(Math.floor(Date.now() / 1000))]
    );
    const msgHash = ethers.keccak256(ethers.solidityPacked(["bytes32", "bytes"], [teeId, payload]));
    const badSignature = await ethers.Wallet.createRandom().signMessage(ethers.getBytes(msgHash));

    await expect(
      agentRouter.executeStrategyWithAttestation(teeId, payload, badSignature)
    ).to.be.revertedWith("AgentRouter: invalid TEE attestation");
  });

  it("rejects payloads from unregistered TEE IDs", async function () {
    const { user1, invoiceNFT, yieldVault, agentRouter, teeSigner } =
      await deployFCCContracts();

    const tokenId = await mintAndDeposit(user1, invoiceNFT, yieldVault, 0);
    const fakeTeeId = ethers.keccak256(ethers.toUtf8Bytes("unregistered"));

    const { payload, signature } = await createAttestation(
      teeSigner, fakeTeeId, tokenId, 1, 80, "Fake TEE", Date.now()
    );

    await expect(
      agentRouter.executeStrategyWithAttestation(fakeTeeId, payload, signature)
    ).to.be.revertedWith("AgentRouter: invalid TEE attestation");
  });

  it("rejects out-of-range strategy values", async function () {
    const { user1, invoiceNFT, yieldVault, agentRouter, teeSigner, teeId } =
      await deployFCCContracts();

    const tokenId = await mintAndDeposit(user1, invoiceNFT, yieldVault, 0);

    // strategy = 3 is beyond Aggressive (max = 2)
    const payload = ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256", "uint8", "uint256", "string", "uint256", "uint256"],
      [tokenId, 3, 80n, "Bad strategy", BigInt(Date.now()), BigInt(Math.floor(Date.now() / 1000))]
    );
    const msgHash = ethers.keccak256(ethers.solidityPacked(["bytes32", "bytes"], [teeId, payload]));
    const sig = await teeSigner.signMessage(ethers.getBytes(msgHash));

    await expect(
      agentRouter.executeStrategyWithAttestation(teeId, payload, sig)
    ).to.be.revertedWith("AgentRouter: strategy value out of range");
  });

  it("rejects stale payloads (timestamp older than teePayloadMaxAge)", async function () {
    const { user1, invoiceNFT, yieldVault, agentRouter, teeSigner, teeId } =
      await deployFCCContracts();

    const tokenId = await mintAndDeposit(user1, invoiceNFT, yieldVault, 0);

    // Create payload with a timestamp 10 minutes behind the current block timestamp
    const latestBlock = await ethers.provider.getBlock("latest");
    const staleTimestamp = latestBlock.timestamp - 10 * 60;
    const payload = ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256", "uint8", "uint256", "string", "uint256", "uint256"],
      [tokenId, 1, 75n, "Stale payload", BigInt(Date.now()), BigInt(staleTimestamp)]
    );
    const msgHash = ethers.keccak256(ethers.solidityPacked(["bytes32", "bytes"], [teeId, payload]));
    const sig = await teeSigner.signMessage(ethers.getBytes(msgHash));

    await expect(
      agentRouter.executeStrategyWithAttestation(teeId, payload, sig)
    ).to.be.revertedWith("AgentRouter: TEE payload expired");
  });

  it("blocks recordDecision when teeAttestationMode is active", async function () {
    const { agent, user1, invoiceNFT, yieldVault, agentRouter } =
      await deployFCCContracts();

    const tokenId = await mintAndDeposit(user1, invoiceNFT, yieldVault, 0);

    await expect(
      agentRouter.connect(agent).recordDecision(tokenId, 1, 80, "Blocked in TEE mode")
    ).to.be.revertedWith("AgentRouter: TEE mode active; use executeStrategyWithAttestation");
  });

  it("blocks batchRecordAndExecute when teeAttestationMode is active", async function () {
    const { agent, user1, invoiceNFT, yieldVault, agentRouter } =
      await deployFCCContracts();

    const tokenId = await mintAndDeposit(user1, invoiceNFT, yieldVault, 0);

    await expect(
      agentRouter.connect(agent).batchRecordAndExecute([tokenId], [1], [80], ["Blocked"])
    ).to.be.revertedWith("AgentRouter: TEE mode active; use executeStrategyWithAttestation");
  });

  it("executeStrategyWithAttestation requires teeAttestationMode to be on", async function () {
    const base = await deployCoreContracts();
    const teeSigner = ethers.Wallet.createRandom();
    const teeId = ethers.keccak256(ethers.toUtf8Bytes("test-tee"));

    const MockFDCVerifier = await ethers.getContractFactory("MockFDCVerifier");
    const mockFDC = await MockFDCVerifier.deploy();
    await mockFDC.waitForDeployment();
    await mockFDC.registerTEE(teeId, teeSigner.address);

    await base.agentRouter.setFDCVerifier(await mockFDC.getAddress());
    // teeAttestationMode stays false (not set)

    const tokenId = await mintAndDeposit(base.user1, base.invoiceNFT, base.yieldVault, 0);
    base.agentRouter.setDecisionCooldown(0);

    const { payload, signature } = await createAttestation(
      teeSigner, teeId, tokenId, 1, 80, "TEE mode off", Date.now()
    );

    await expect(
      base.agentRouter.executeStrategyWithAttestation(teeId, payload, signature)
    ).to.be.revertedWith("AgentRouter: TEE mode not active; call setTEEAttestationMode(true)");
  });
});

describe("PrivacyRegistry Ã¢â‚¬â€ TEE audit trail", function () {
  it("logs an immutable audit entry after TEE-attested execution", async function () {
    const { user1, invoiceNFT, yieldVault, agentRouter, privacyRegistry, teeSigner, teeId } =
      await deployFCCContracts();

    const tokenId = await mintAndDeposit(user1, invoiceNFT, yieldVault, 0);

    const { payload, signature } = await createAttestation(
      teeSigner, teeId, tokenId, 2, 90, "Audit trail test", Date.now()
    );

    await agentRouter.executeStrategyWithAttestation(teeId, payload, signature);

    const count = await privacyRegistry.getTEEAuditCount();
    expect(count).to.equal(1n);

    const entry = await privacyRegistry.getTEEAuditEntry(0n);
    expect(entry.teeId).to.equal(teeId);
    expect(entry.tokenId).to.equal(tokenId);
    expect(entry.strategy).to.equal(2);
    expect(entry.confidence).to.equal(90n);
    expect(entry.router).to.equal(await agentRouter.getAddress());
  });

  it("getTEEAuditEntriesForToken returns only matching entries", async function () {
    const { user1, user2, invoiceNFT, yieldVault, agentRouter, privacyRegistry, teeSigner, teeId } =
      await deployFCCContracts();

    const tokenA = await mintAndDeposit(user1, invoiceNFT, yieldVault, 0);
    const tokenB = await mintAndDeposit(user2, invoiceNFT, yieldVault, 0);

    const att1 = await createAttestation(teeSigner, teeId, tokenA, 1, 75, "Token A", Date.now());
    await agentRouter.executeStrategyWithAttestation(teeId, att1.payload, att1.signature);

    const att2 = await createAttestation(teeSigner, teeId, tokenB, 2, 85, "Token B", Date.now() + 1);
    await agentRouter.executeStrategyWithAttestation(teeId, att2.payload, att2.signature);

    const entriesA = await privacyRegistry.getTEEAuditEntriesForToken(tokenA);
    expect(entriesA.length).to.equal(1);
    expect(entriesA[0].tokenId).to.equal(tokenA);

    const entriesB = await privacyRegistry.getTEEAuditEntriesForToken(tokenB);
    expect(entriesB.length).to.equal(1);
    expect(entriesB[0].tokenId).to.equal(tokenB);
  });

  it("rejects logTEEStrategyChange from unauthorized callers", async function () {
    const { user1, privacyRegistry, teeId } = await deployFCCContracts();

    await expect(
      privacyRegistry.connect(user1).logTEEStrategyChange(teeId, 1n, 1, 80n)
    ).to.be.revertedWith("PrivacyRegistry: not authorized router");
  });

  it("audit log is append-only Ã¢â‚¬â€ multiple entries accumulate", async function () {
    const { user1, invoiceNFT, yieldVault, agentRouter, privacyRegistry, teeSigner, teeId } =
      await deployFCCContracts();

    const tokenId = await mintAndDeposit(user1, invoiceNFT, yieldVault, 0);

    // Three consecutive attestations (each increments nonce, so each uses a unique nonce)
    for (let i = 0; i < 3; i++) {
      const att = await createAttestation(
        teeSigner, teeId, tokenId, i % 3, 80 + i, `Round ${i}`, Date.now() + i * 1000
      );
      await agentRouter.executeStrategyWithAttestation(teeId, att.payload, att.signature);
    }

    expect(await privacyRegistry.getTEEAuditCount()).to.equal(3n);
  });
});

describe("InvoiceNFT - FCC encrypted mint", function () {
  it("mints only after a valid FCC attestation over encrypted invoice commitments", async function () {
    const { user1, invoiceNFT, mockFDC, teeSigner, teeId } = await deployFCCContracts();
    await invoiceNFT.setFDCVerifier(await mockFDC.getAddress());
    await invoiceNFT.setMintAttestationMode(true);

    const dataCommitment = ethers.keccak256(ethers.toUtf8Bytes("encrypted-data-commitment"));
    const amountCommitment = ethers.keccak256(ethers.toUtf8Bytes("amount-commitment"));
    const encryptedInvoiceHash = ethers.keccak256(ethers.toUtf8Bytes("ciphertext"));
    const dueDate = (await ethers.provider.getBlock("latest")).timestamp + 86400 * 45;
    const nonce = Date.now();
    const att = await createMintAttestation(
      teeSigner, teeId, user1, dataCommitment, amountCommitment, encryptedInvoiceHash, dueDate, nonce
    );

    await expect(invoiceNFT.connect(user1).mintWithAttestation(teeId, att.payload, att.signature))
      .to.emit(invoiceNFT, "FCCInvoiceMinted");

    const tokenId = (await invoiceNFT.totalInvoices()) - 1n;
    const invoice = await invoiceNFT.getInvoice(tokenId);
    expect(invoice.issuer).to.equal(user1.address);
    expect(invoice.dataCommitment).to.equal(dataCommitment);

    const mintAttestation = await invoiceNFT.mintAttestations(tokenId);
    expect(mintAttestation.attested).to.equal(true);
    expect(mintAttestation.teeId).to.equal(teeId);
    expect(mintAttestation.encryptedInvoiceHash).to.equal(encryptedInvoiceHash);
  });

  it("blocks legacy mint when FCC mint attestation mode is active", async function () {
    const { user1, invoiceNFT, mockFDC } = await deployFCCContracts();
    await invoiceNFT.setFDCVerifier(await mockFDC.getAddress());
    await invoiceNFT.setMintAttestationMode(true);

    const commitment = ethers.keccak256(ethers.toUtf8Bytes("legacy"));
    const dueDate = (await ethers.provider.getBlock("latest")).timestamp + 86400 * 30;
    await expect(invoiceNFT.connect(user1).mint(commitment, commitment, dueDate))
      .to.be.revertedWith("FCC mint attestation required");
  });

  it("rejects replayed FCC mint nonces", async function () {
    const { user1, invoiceNFT, mockFDC, teeSigner, teeId } = await deployFCCContracts();
    await invoiceNFT.setFDCVerifier(await mockFDC.getAddress());
    await invoiceNFT.setMintAttestationMode(true);

    const dataCommitment = ethers.keccak256(ethers.toUtf8Bytes("data"));
    const amountCommitment = ethers.keccak256(ethers.toUtf8Bytes("amount"));
    const encryptedInvoiceHash = ethers.keccak256(ethers.toUtf8Bytes("ciphertext"));
    const dueDate = (await ethers.provider.getBlock("latest")).timestamp + 86400 * 30;
    const nonce = Date.now();
    const att = await createMintAttestation(
      teeSigner, teeId, user1, dataCommitment, amountCommitment, encryptedInvoiceHash, dueDate, nonce
    );

    await invoiceNFT.connect(user1).mintWithAttestation(teeId, att.payload, att.signature);
    await expect(invoiceNFT.connect(user1).mintWithAttestation(teeId, att.payload, att.signature))
      .to.be.revertedWith("FCC mint nonce already used");
  });

  it("rejects FCC mint payloads signed by an unauthorized signer", async function () {
    const { user1, invoiceNFT, mockFDC, teeId } = await deployFCCContracts();
    await invoiceNFT.setFDCVerifier(await mockFDC.getAddress());
    await invoiceNFT.setMintAttestationMode(true);

    const dataCommitment = ethers.keccak256(ethers.toUtf8Bytes("data"));
    const amountCommitment = ethers.keccak256(ethers.toUtf8Bytes("amount"));
    const encryptedInvoiceHash = ethers.keccak256(ethers.toUtf8Bytes("ciphertext"));
    const dueDate = (await ethers.provider.getBlock("latest")).timestamp + 86400 * 30;
    const badSigner = ethers.Wallet.createRandom();
    const att = await createMintAttestation(
      badSigner, teeId, user1, dataCommitment, amountCommitment, encryptedInvoiceHash, dueDate, Date.now()
    );

    await expect(invoiceNFT.connect(user1).mintWithAttestation(teeId, att.payload, att.signature))
      .to.be.revertedWith("Invalid FCC mint attestation");
  });
});