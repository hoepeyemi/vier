const hre = require("hardhat");
const deployment = require("../deployments/coston2.json");

async function verify(name, address, constructorArguments = [], contract) {
  if (!address) {
    console.log(`Skipping ${name}: no address in deployment manifest`);
    return;
  }

  console.log(`\nVerifying ${name}: ${address}`);
  try {
    await hre.run("verify:verify", {
      address,
      constructorArguments,
      ...(contract ? { contract } : {}),
    });
    console.log(`Verified ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes("already verified")) {
      console.log(`${name} already verified`);
      return;
    }
    console.error(`Failed to verify ${name}: ${message}`);
    throw error;
  }
}

async function main() {
  await verify("InvoiceNFT", deployment.invoiceNFT, [], "src/InvoiceNFT.sol:InvoiceNFT");
  await verify("YieldVault", deployment.yieldVault, [deployment.invoiceNFT], "src/YieldVault.sol:YieldVault");
  await verify("PrivacyRegistry", deployment.privacyRegistry, [], "src/PrivacyRegistry.sol:PrivacyRegistry");
  await verify("AgentRouter", deployment.agentRouter, [deployment.invoiceNFT, deployment.yieldVault], "src/AgentRouter.sol:AgentRouter");
  await verify("MockFDCVerifier", deployment.mockFDCVerifier, [], "src/mocks/MockFDCVerifier.sol:MockFDCVerifier");

  if (deployment.ftsoOracle) {
    await verify(
      "FtsoOracle",
      deployment.ftsoOracle,
      [
        deployment.invoiceNFT,
        deployment.flareContractRegistry,
        deployment.ftsoNativeUsdFeedId,
        deployment.ftsoEthUsdFeedId,
      ],
      "src/FtsoOracle.sol:FtsoOracle"
    );
  } else {
    await verify("MockOracle", deployment.mockOracle, [deployment.invoiceNFT], "src/MockOracle.sol:MockOracle");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});