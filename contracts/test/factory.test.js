const { expect } = require("chai");
const { ethers } = require("hardhat");

async function getBytecode(name) {
  return (await ethers.getContractFactory(name)).bytecode;
}

async function getProtocolBytecode() {
  return {
    invoiceNFT: await getBytecode("src/InvoiceNFT.sol:InvoiceNFT"),
    yieldVault: await getBytecode("YieldVault"),
    agentRouter: await getBytecode("AgentRouter"),
    mockOracle: await getBytecode("MockOracle"),
    privacyRegistry: await getBytecode("PrivacyRegistry"),
  };
}

async function deployFactory() {
  const VierFactory = await ethers.getContractFactory("VierFactory");
  return VierFactory.deploy();
}

function protocolEventArgs(receipt, factory) {
  return receipt.logs
    .map((log) => {
      try {
        return factory.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((event) => event && event.name === "ProtocolDeployed").args;
}

describe("VierFactory", function () {
  it("deploys, wires, and transfers ownership for the full demo stack", async function () {
    const [deployer] = await ethers.getSigners();
    const factory = await deployFactory();

    const tx = await factory.deployProtocol(await getProtocolBytecode());
    const receipt = await tx.wait();
    const deployed = protocolEventArgs(receipt, factory);

    const invoiceNFT = await ethers.getContractAt("src/InvoiceNFT.sol:InvoiceNFT", deployed.invoiceNFT);
    const yieldVault = await ethers.getContractAt("YieldVault", deployed.yieldVault);
    const agentRouter = await ethers.getContractAt("AgentRouter", deployed.agentRouter);
    const mockOracle = await ethers.getContractAt("MockOracle", deployed.mockOracle);
    const privacyRegistry = await ethers.getContractAt("PrivacyRegistry", deployed.privacyRegistry);

    expect(await invoiceNFT.owner()).to.equal(deployer.address);
    expect(await yieldVault.owner()).to.equal(deployer.address);
    expect(await agentRouter.owner()).to.equal(deployer.address);
    expect(await mockOracle.owner()).to.equal(deployer.address);
    expect(await privacyRegistry.owner()).to.equal(deployer.address);

    expect(await invoiceNFT.yieldVault()).to.equal(deployed.yieldVault);
    expect(await invoiceNFT.agentRouter()).to.equal(deployed.agentRouter);
    expect(await invoiceNFT.oracle()).to.equal(deployed.mockOracle);
    expect(await yieldVault.agentRouter()).to.equal(deployed.agentRouter);
  });

  it("deploys production stack with an external oracle", async function () {
    const [deployer, oracleOwner] = await ethers.getSigners();
    const factory = await deployFactory();
    const MockOracle = await ethers.getContractFactory("MockOracle");
    const InvoiceNFT = await ethers.getContractFactory("src/InvoiceNFT.sol:InvoiceNFT");
    const externalInvoice = await InvoiceNFT.deploy();
    const externalOracle = await MockOracle.connect(oracleOwner).deploy(await externalInvoice.getAddress());

    const bytecode = await getProtocolBytecode();
    const productionBytecode = {
      invoiceNFT: bytecode.invoiceNFT,
      yieldVault: bytecode.yieldVault,
      agentRouter: bytecode.agentRouter,
      privacyRegistry: bytecode.privacyRegistry,
    };

    const tx = await factory.deployProtocolWithOracle(productionBytecode, await externalOracle.getAddress());
    const receipt = await tx.wait();
    const deployed = protocolEventArgs(receipt, factory);
    const invoiceNFT = await ethers.getContractAt("src/InvoiceNFT.sol:InvoiceNFT", deployed.invoiceNFT);

    expect(deployed.mockOracle).to.equal(await externalOracle.getAddress());
    expect(await invoiceNFT.oracle()).to.equal(await externalOracle.getAddress());
    expect(await externalOracle.owner()).to.equal(oracleOwner.address);
    expect(await invoiceNFT.owner()).to.equal(deployer.address);
  });

  it("reverts on empty bytecode and zero external oracle", async function () {
    const factory = await deployFactory();
    const bytecode = await getProtocolBytecode();

    await expect(factory.deployProtocol({ ...bytecode, invoiceNFT: "0x" }))
      .to.be.revertedWithCustomError(factory, "EmptyBytecode");

    await expect(factory.deployProtocolWithOracle({
      invoiceNFT: bytecode.invoiceNFT,
      yieldVault: bytecode.yieldVault,
      agentRouter: bytecode.agentRouter,
      privacyRegistry: bytecode.privacyRegistry,
    }, ethers.ZeroAddress)).to.be.revertedWithCustomError(factory, "InvalidOracle");
  });
});