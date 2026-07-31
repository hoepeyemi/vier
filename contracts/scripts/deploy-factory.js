const hre = require("hardhat");

async function getBytecode(contractName) {
  const factory = await hre.ethers.getContractFactory(contractName);
  return factory.bytecode;
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying vier Factory with deployer:", deployer.address);

  const VierFactory = await hre.ethers.getContractFactory("VierFactory");
  const factory = await VierFactory.deploy();
  await factory.waitForDeployment();

  const protocolBytecode = {
    invoiceNFT: await getBytecode("src/InvoiceNFT.sol:InvoiceNFT"),
    yieldVault: await getBytecode("YieldVault"),
    agentRouter: await getBytecode("AgentRouter"),
    mockOracle: await getBytecode("MockOracle"),
    privacyRegistry: await getBytecode("PrivacyRegistry"),
  };

  const tx = await factory.deployProtocol(protocolBytecode);
  const receipt = await tx.wait();
  const event = receipt.logs
    .map((log) => {
      try {
        return factory.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((log) => log && log.name === "ProtocolDeployed");

  console.log("VierFactory deployed at:", await factory.getAddress());
  console.log("=== vier Protocol Deployed ===");
  console.log("Deployment tx:", receipt.hash);

  if (event) {
    console.log("INVOICE_NFT:", event.args.invoiceNFT);
    console.log("YIELD_VAULT:", event.args.yieldVault);
    console.log("AGENT_ROUTER:", event.args.agentRouter);
    console.log("MOCK_ORACLE:", event.args.mockOracle);
    console.log("PRIVACY_REGISTRY:", event.args.privacyRegistry);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});