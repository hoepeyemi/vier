// Deploy vier Protocol to Flare Coston2 Testnet (chainId 114)
// Run: pnpm run deploy:coston2

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

const FLARE_CONTRACT_REGISTRY = "0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019";
const FLR_USD_FEED_ID = "0x01464c522f55534400000000000000000000000000";
const ETH_USD_FEED_ID = "0x014554482f55534400000000000000000000000000";
const FCE_IMAGE_HASH_DEFAULT = "0x7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069";

async function resolveRegistryContract(name) {
  const registry = await hre.ethers.getContractAt(
    ["function getContractAddressByName(string calldata name) view returns (address)"],
    process.env.FLARE_CONTRACT_REGISTRY_ADDRESS || FLARE_CONTRACT_REGISTRY
  );
  const resolved = await registry.getContractAddressByName(name);
  if (!resolved || resolved === hre.ethers.ZeroAddress) {
    throw new Error(`${name} is not available from FlareContractRegistry on this network`);
  }
  return resolved;
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();
  const balance = await hre.ethers.provider.getBalance(deployer.address);

  console.log("");
  console.log("=".repeat(60));
  console.log("  vier Protocol - Flare Coston2 Deployment");
  console.log("=".repeat(60));
  console.log(`  Network:  ${network.name} (chainId ${network.chainId})`);
  console.log(`  Deployer: ${deployer.address}`);
  console.log(`  Balance:  ${hre.ethers.formatEther(balance)} CFLR`);
  console.log("=".repeat(60));
  console.log("");

  if (balance === 0n) {
    throw new Error("Deployer has no CFLR. Get Coston2 tokens from https://faucet.flare.network");
  }

  const flareContractRegistry = process.env.FLARE_CONTRACT_REGISTRY_ADDRESS || FLARE_CONTRACT_REGISTRY;
  const ftsoV2Address = await resolveRegistryContract("FtsoV2");
  console.log(`FlareContractRegistry: ${flareContractRegistry}`);
  console.log(`FtsoV2: resolved via registry -> ${ftsoV2Address}`);
  console.log("");

  console.log("1/6  Deploying InvoiceNFT...");
  const InvoiceNFT = await hre.ethers.getContractFactory("src/InvoiceNFT.sol:InvoiceNFT");
  const invoiceNFT = await InvoiceNFT.deploy();
  await invoiceNFT.waitForDeployment();
  const invoiceNFTAddress = await invoiceNFT.getAddress();
  console.log(`     InvoiceNFT: ${invoiceNFTAddress}`);

  console.log("2/6  Deploying YieldVault...");
  const YieldVault = await hre.ethers.getContractFactory("YieldVault");
  const yieldVault = await YieldVault.deploy(invoiceNFTAddress);
  await yieldVault.waitForDeployment();
  const yieldVaultAddress = await yieldVault.getAddress();
  console.log(`     YieldVault: ${yieldVaultAddress}`);

  console.log("3/6  Deploying PrivacyRegistry...");
  const PrivacyRegistry = await hre.ethers.getContractFactory("PrivacyRegistry");
  const privacyRegistry = await PrivacyRegistry.deploy();
  await privacyRegistry.waitForDeployment();
  const privacyRegistryAddress = await privacyRegistry.getAddress();
  console.log(`     PrivacyRegistry: ${privacyRegistryAddress}`);

  console.log("4/6  Deploying AgentRouter...");
  const AgentRouter = await hre.ethers.getContractFactory("AgentRouter");
  const agentRouter = await AgentRouter.deploy(invoiceNFTAddress, yieldVaultAddress);
  await agentRouter.waitForDeployment();
  const agentRouterAddress = await agentRouter.getAddress();
  console.log(`     AgentRouter: ${agentRouterAddress}`);

  console.log("5/6  Deploying MockFDCVerifier (FCC demo verifier)...");
  const MockFDCVerifier = await hre.ethers.getContractFactory("MockFDCVerifier");
  const mockFDCVerifier = await MockFDCVerifier.deploy();
  await mockFDCVerifier.waitForDeployment();
  const mockFDCVerifierAddress = await mockFDCVerifier.getAddress();
  console.log(`     MockFDCVerifier: ${mockFDCVerifierAddress}`);

  console.log("6/6  Deploying FtsoOracle...");
  const FtsoOracle = await hre.ethers.getContractFactory("FtsoOracle");
  const ftsoOracle = await FtsoOracle.deploy(
    invoiceNFTAddress,
    flareContractRegistry,
    process.env.FTSO_NATIVE_USD_FEED_ID || FLR_USD_FEED_ID,
    process.env.FTSO_ETH_USD_FEED_ID || ETH_USD_FEED_ID
  );
  await ftsoOracle.waitForDeployment();
  const ftsoOracleAddress = await ftsoOracle.getAddress();
  console.log(`     FtsoOracle: ${ftsoOracleAddress}`);

  console.log("");
  console.log("Wiring contract cross-references...");
  await (await invoiceNFT.setYieldVault(yieldVaultAddress)).wait();
  await (await invoiceNFT.setAgentRouter(agentRouterAddress)).wait();
  await (await invoiceNFT.setOracle(ftsoOracleAddress)).wait();
  await (await yieldVault.setAgentRouter(agentRouterAddress)).wait();

  await (await invoiceNFT.setFDCVerifier(mockFDCVerifierAddress)).wait();
  await (await invoiceNFT.setMintAttestationMode(true)).wait();
  await (await agentRouter.setFDCVerifier(mockFDCVerifierAddress)).wait();
  await (await agentRouter.setPrivacyRegistry(privacyRegistryAddress)).wait();
  await (await agentRouter.setTEEAttestationMode(true)).wait();
  await (await privacyRegistry.addAuthorizedRouter(agentRouterAddress)).wait();

  const fceImageHash = process.env.FCE_IMAGE_HASH || FCE_IMAGE_HASH_DEFAULT;
  const teeId = hre.ethers.keccak256(hre.ethers.solidityPacked(["bytes32", "uint256"], [fceImageHash, 114n]));
  const teeSignerAddress = process.env.AGENT_WALLET_ADDRESS || deployer.address;

  await (await mockFDCVerifier.registerTEE(teeId, teeSignerAddress)).wait();
  if (teeSignerAddress.toLowerCase() !== deployer.address.toLowerCase()) {
    await (await agentRouter.authorizeAgent(teeSignerAddress)).wait();
    await (await ftsoOracle.setDataProvider(teeSignerAddress, true)).wait();
  }

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
    ftsoOracle: ftsoOracleAddress,
    flareContractRegistry,
    ftsoV2: ftsoV2Address,
    ftsoNativeUsdFeedId: process.env.FTSO_NATIVE_USD_FEED_ID || FLR_USD_FEED_ID,
    ftsoEthUsdFeedId: process.env.FTSO_ETH_USD_FEED_ID || ETH_USD_FEED_ID,
    fccConfig: {
      teeId,
      teeSignerAddress,
      fceImageHash,
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
  console.log("  Flare Coston2 Deployment Complete");
  console.log("=".repeat(60));
  console.log(`  InvoiceNFT:      ${invoiceNFTAddress}`);
  console.log(`  YieldVault:      ${yieldVaultAddress}`);
  console.log(`  PrivacyRegistry: ${privacyRegistryAddress}`);
  console.log(`  AgentRouter:     ${agentRouterAddress}`);
  console.log(`  MockFDCVerifier: ${mockFDCVerifierAddress}`);
  console.log(`  FtsoOracle:      ${ftsoOracleAddress}`);
  console.log(`  FtsoV2:          ${ftsoV2Address} (registry-resolved)`);
  console.log("");
  console.log("  FCC Configuration:");
  console.log(`    teeId:   ${teeId}`);
  console.log(`    signer:  ${teeSignerAddress}`);
  console.log("");
  console.log(`  Saved to: ${outPath}`);
  console.log("=".repeat(60));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});