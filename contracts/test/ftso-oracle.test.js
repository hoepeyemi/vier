const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployCoreContracts, increaseTime } = require("./helpers");

const FLR_USD_FEED_ID = "0x01464c522f55534400000000000000000000000000";
const ETH_USD_FEED_ID = "0x014554482f55534400000000000000000000000000";

describe("FtsoOracle", function () {
  async function deployFixture() {
    const core = await deployCoreContracts();
    const now = (await ethers.provider.getBlock("latest")).timestamp;

    const MockFtsoV2 = await ethers.getContractFactory("MockFtsoV2");
    const mockFtsoV2 = await MockFtsoV2.deploy(ethers.parseEther("0.006"), now);
    await mockFtsoV2.waitForDeployment();

    const MockFlareContractRegistry = await ethers.getContractFactory("MockFlareContractRegistry");
    const registry = await MockFlareContractRegistry.deploy();
    await registry.waitForDeployment();
    await registry.setContractAddressByName("FtsoV2", await mockFtsoV2.getAddress());

    const FtsoOracle = await ethers.getContractFactory("FtsoOracle");
    const ftsoOracle = await FtsoOracle.deploy(
      await core.invoiceNFT.getAddress(),
      await registry.getAddress(),
      FLR_USD_FEED_ID,
      ETH_USD_FEED_ID
    );
    await ftsoOracle.waitForDeployment();
    await core.invoiceNFT.setOracle(await ftsoOracle.getAddress());

    return { ...core, now, mockFtsoV2, registry, ftsoOracle };
  }

  it("resolves FtsoV2 through FlareContractRegistry", async function () {
    const { mockFtsoV2, ftsoOracle } = await deployFixture();
    expect(await ftsoOracle.resolveFtsoV2()).to.equal(await mockFtsoV2.getAddress());
  });

  it("reads FTSOv2 and updates InvoiceNFT risk metrics", async function () {
    const { user1, invoiceNFT, ftsoOracle, now } = await deployFixture();
    const commitment = ethers.keccak256(ethers.toUtf8Bytes("ftso invoice"));
    await invoiceNFT.connect(user1).mint(commitment, commitment, now + 60 * 60 * 24 * 45);
    const tokenId = (await invoiceNFT.totalInvoices()) - 1n;

    await expect(ftsoOracle.assessAndUpdateRisk(tokenId))
      .to.emit(ftsoOracle, "RiskDataUpdated")
      .withArgs(tokenId, 85, 92, ethers.parseEther("0.006"), now);

    expect(await ftsoOracle.getRiskScore(tokenId)).to.equal(85);
    expect(await ftsoOracle.getPaymentProbability(tokenId)).to.equal(92);

    const invoice = await invoiceNFT.getInvoice(tokenId);
    expect(invoice.riskScore).to.equal(85n);
    expect(invoice.paymentProbability).to.equal(92n);
  });

  it("reduces risk after a large FTSOv2 market move", async function () {
    const { user1, invoiceNFT, ftsoOracle, mockFtsoV2, now } = await deployFixture();
    const commitment = ethers.keccak256(ethers.toUtf8Bytes("volatile invoice"));
    await invoiceNFT.connect(user1).mint(commitment, commitment, now + 60 * 60 * 24 * 45);
    const firstTokenId = (await invoiceNFT.totalInvoices()) - 1n;
    await ftsoOracle.assessAndUpdateRisk(firstTokenId);

    await mockFtsoV2.setFeed(ethers.parseEther("0.0048"), now + 60);
    await invoiceNFT.connect(user1).mint(commitment, commitment, now + 60 * 60 * 24 * 45);
    const secondTokenId = (await invoiceNFT.totalInvoices()) - 1n;
    await ftsoOracle.assessAndUpdateRisk(secondTokenId);

    expect(await ftsoOracle.getRiskScore(secondTokenId)).to.equal(70);
    expect(await ftsoOracle.getPaymentProbability(secondTokenId)).to.equal(77);
  });

  it("rejects stale FTSOv2 prices", async function () {
    const { user1, invoiceNFT, ftsoOracle, now } = await deployFixture();
    const commitment = ethers.keccak256(ethers.toUtf8Bytes("stale invoice"));
    await invoiceNFT.connect(user1).mint(commitment, commitment, now + 60 * 60 * 24 * 45);
    const tokenId = (await invoiceNFT.totalInvoices()) - 1n;

    await increaseTime(11 * 60);
    await expect(ftsoOracle.assessAndUpdateRisk(tokenId)).to.be.revertedWith("Stale FTSO price");
  });

  it("allows an explicit FtsoV2 override while keeping registry-first default", async function () {
    const { ftsoOracle, now } = await deployFixture();
    const MockFtsoV2 = await ethers.getContractFactory("MockFtsoV2");
    const replacement = await MockFtsoV2.deploy(ethers.parseEther("0.007"), now);
    await replacement.waitForDeployment();

    await ftsoOracle.setFtsoV2Override(await replacement.getAddress());
    expect(await ftsoOracle.resolveFtsoV2()).to.equal(await replacement.getAddress());
  });
});