// Deploy vier Protocol to Flare Coston2 Testnet (chainId 114)
// Run: npx hardhat run scripts/deploy-coston2.js --network coston2
//
// Prerequisites:
//   1. Set PRIVATE_KEY in contracts/.env
//   2. Fund your wallet with Coston2 testnet CFLR from: https://faucet.flare.network
//   3. Optional: set AGENT_WALLET_ADDRESS if the agent wallet differs from the deployer

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();

  console.log("");
  console.log("=".repeat(60));
  console.log("  vier Protocol Ã¢â‚¬â€ Flare Coston2 Deployment");
  console.log("=".repeat(60));
  console.log(`  Network:  ${network.name} (chainId ${network.chainId})`);
  console.log(`  Deployer: ${deployer.address}`);
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`  Balance:  ${hre.ethers.formatEther(balance)} CFLR`);
  console.log("=".repeat(60));
  console.log("");

  if (balance === 0n) {
    console.error("Ã¢ÂÅ’ Deployer has no CFLR. Get testnet tokens at: https://faucet.flare.network");
    process.exit(1);
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ 1. Core contracts Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  console.log("1/6  Deploying InvoiceNFT...");
  const InvoiceNFT = await hre.ethers.getContractFactory("src/InvoiceNFT.sol:InvoiceNFT");
  const invoiceNFT = await InvoiceNFT.deploy();
  await invoiceNFT.waitForDeployment();
  const invoiceNFTAddress = await invoiceNFT.getAddress();
  console.log(`     Ã¢Å“â€¦ InvoiceNFT: ${invoiceNFTAddress}`);

  console.log("2/6  Deploying YieldVault...");
  const YieldVault = await hre.ethers.getContractFactory("YieldVault");
  const yieldVault = await YieldVault.deploy(invoiceNFTAddress);
  await yieldVault.waitForDeployment();
  const yieldVaultAddress = await yieldVault.getAddress();
  console.log(`     Ã¢Å“â€¦ YieldVault: ${yieldVaultAddress}`);

  console.log("3/6  Deploying PrivacyRegistry...");
  const PrivacyRegistry = await hre.ethers.getContractFactory("PrivacyRegistry");
  const privacyRegistry = await PrivacyRegistry.deploy();
  await privacyRegistry.waitForDeployment();
  const privacyRegistryAddress = await privacyRegistry.getAddress();
  console.log(`     Ã¢Å“â€¦ PrivacyRegistry: ${privacyRegistryAddress}`);

  console.log("4/6  Deploying AgentRouter...");
  const AgentRouter = await hre.ethers.getContractFactory("AgentRouter");
  const agentRouter = await AgentRouter.deploy(invoiceNFTAddress, yieldVaultAddress);
  await agentRouter.waitForDeployment();
  const agentRouterAddress = await agentRouter.getAddress();
  console.log(`     Ã¢Å“â€¦ AgentRouter: ${agentRouterAddress}`);

  // Ã¢â€â‚¬Ã¢â€â‚¬ 2. Flare FCC contracts Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  console.log("5/6  Deploying MockFDCVerifier (Flare Confidential Compute)...");
  const MockFDCVerifier = await hre.ethers.getContractFactory("MockFDCVerifier");
  const mockFDCVerifier = await MockFDCVerifier.deploy();
  await mockFDCVerifier.waitForDeployment();
  const mockFDCVerifierAddress = await mockFDCVerifier.getAddress();
  console.log(`     Ã¢Å“â€¦ MockFDCVerifier: ${mockFDCVerifierAddress}`);

  console.log("6/6  Deploying MockOracle...");
  const MockOracle = await hre.ethers.getContractFactory("MockOracle");
  const mockOracle = await MockOracle.deploy(invoiceNFTAddress);
  await mockOracle.waitForDeployment();
  const mockOracleAddress = await mockOracle.getAddress();
  console.log(`     Ã¢Å“â€¦ MockOracle: ${mockOracleAddress}`);

  // Ã¢â€â‚¬Ã¢â€â‚¬ 3. Wire contracts Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  console.log("");
  console.log("Wiring contract cross-references...");

  await (await invoiceNFT.setYieldVault(yieldVaultAddress)).wait();
  await (await invoiceNFT.setAgentRouter(agentRouterAddress)).wait();
  await (await invoiceNFT.setOracle(mockOracleAddress)).wait();
  await (await yieldVault.setAgentRouter(agentRouterAddress)).wait();

  // Configure contracts with Flare FCC integration
  await (await invoiceNFT.setFDCVerifier(mockFDCVerifierAddress)).wait();
  await (await invoiceNFT.setMintAttestationMode(true)).wait();
  await (await agentRouter.setFDCVerifier(mockFDCVerifierAddress)).wait();
  await (await agentRouter.setPrivacyRegistry(privacyRegistryAddress)).wait();
  await (await agentRouter.setTEEAttestationMode(true)).wait();

  // Authorize AgentRouter to write TEE audit entries to PrivacyRegistry
  await (await privacyRegistry.addAuthorizedRouter(agentRouterAddress)).wait();

  // Ã¢â€â‚¬Ã¢â€â‚¬ 4. Register TEE identity Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  // teeId = keccak256(abi.encodePacked(imageHash, chainId))
  // The FCE_IMAGE_HASH should be the sha256 of the Dockerfile.fce image digest.
  // For testnet demos, any bytes32 works Ã¢â‚¬â€ the agent must use the same value.
  const FCE_IMAGE_HASH =
    process.env.FCE_IMAGE_HASH ||
    "0x7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069";

  const CHAIN_ID = 114n; // Coston2
  const teeId = hre.ethers.keccak256(
    hre.ethers.solidityPacked(["bytes32", "uint256"], [FCE_IMAGE_HASH, CHAIN_ID])
  );

  // The TEE signer address: in a real FCE this is the Flare-injected identity key.
  // For the demo, use the agent's Ethereum wallet (same key the agent uses to sign payloads).
  const teeSignerAddress = process.env.AGENT_WALLET_ADDRESS || deployer.address;

  await (await mockFDCVerifier.registerTEE(teeId, teeSignerAddress)).wait();

  // Also authorise the deployer as an agent (owner is already authorized in constructor)
  if (teeSignerAddress.toLowerCase() !== deployer.address.toLowerCase()) {
    await (await agentRouter.authorizeAgent(teeSignerAddress)).wait();
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ 5. Save deployment Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const deployment = {
    network: "coston2",
    chainId: 114,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    invoiceNFT: invoiceNFTAddress,
    yieldVault: yieldVaultAddress,
    privacyRegistry: privacyRegistryAddress,
    agentRouter: agentRouterAddress,
    mockFDCVerifier: mockFDCVerifierAddress,
    mockOracle: mockOracleAddress,
    fccConfig: {
      teeId,
      teeSignerAddress,
      fceImageHash: FCE_IMAGE_HASH,
      teeAttestationMode: true,
      mintAttestationMode: true,
    },
  };

  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir, { recursive: true });
  const outPath = path.join(deploymentsDir, "coston2.json");
  fs.writeFileSync(outPath, JSON.stringify(deployment, null, 2));

  console.log("");
  console.log("=".repeat(60));
  console.log("  Ã¢Å“â€¦ Flare Coston2 Deployment Complete");
  console.log("=".repeat(60));
  console.log(`  InvoiceNFT:      ${invoiceNFTAddress}`);
  console.log(`  YieldVault:      ${yieldVaultAddress}`);
  console.log(`  PrivacyRegistry: ${privacyRegistryAddress}`);
  console.log(`  AgentRouter:     ${agentRouterAddress}`);
  console.log(`  MockFDCVerifier: ${mockFDCVerifierAddress}  Ã¢â€ Â Flare FCC`);
  console.log(`  MockOracle:      ${mockOracleAddress}`);
  console.log("");
  console.log("  FCC Configuration:");
  console.log(`    teeId:   ${teeId}`);
  console.log(`    signer:  ${teeSignerAddress}`);
  console.log("");
  console.log("  Explorer: https://coston2-explorer.flare.network");
  console.log(`  Saved to: ${outPath}`);
  console.log("");
  console.log("  Next steps:");
  console.log("    1. Copy addresses above into app/src/lib/contracts/addresses.ts");
  console.log("    2. Set these vars in agent/.env:");
  console.log("         DEPLOYMENT_NETWORK=coston2");
  console.log("         FLARE_TEE_ID=" + teeId);
  console.log("         FCE_TEE_MODE=true");
  console.log("       (InvoiceNFT/YieldVault/AgentRouter/MockOracle auto-loaded from coston2.json)");
  console.log("    3. docker build --no-cache -f Dockerfile.fce \\");
  console.log("         --build-arg FCE_IMAGE_HASH=" + FCE_IMAGE_HASH + " \\");
  console.log("         -t vier-fce .");
  console.log("=".repeat(60));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
