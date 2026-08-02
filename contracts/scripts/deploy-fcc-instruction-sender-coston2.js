const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const FLARE_CONTRACT_REGISTRY_ADDRESS =
  process.env.FLARE_CONTRACT_REGISTRY_ADDRESS || "0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019";
const TEE_EXTENSION_REGISTRY_NAME = process.env.TEE_EXTENSION_REGISTRY_NAME || "TeeExtensionRegistry";
const TEE_MACHINE_REGISTRY_NAME = process.env.TEE_MACHINE_REGISTRY_NAME || "TeeMachineRegistry";

const FLARE_CONTRACT_REGISTRY_ABI = [
  "function getContractAddressByName(string calldata name) external view returns (address)",
];

function isValidAddress(value) {
  return Boolean(value && hre.ethers.isAddress(value) && value !== hre.ethers.ZeroAddress);
}

function assertAddress(name, value) {
  if (!isValidAddress(value)) {
    throw new Error(`${name} resolved to an invalid address: ${value || "<empty>"}`);
  }
  return value;
}

function missingRegistryEntryError(contractName, envName, registryAddress, resolved) {
  return new Error(
    [
      `${contractName} is not currently published in FlareContractRegistry on this network.`,
      `Registry: ${registryAddress}`,
      `Lookup:   getContractAddressByName("${contractName}") -> ${resolved || "<empty>"}`,
      "",
      "Flare's current FCC guides note that FCC registry addresses are read from",
      "the FCC scaffold config/coston2/deployed-addresses.json until FCC registry",
      "entries are available through FlareContractRegistry.",
      "",
      `Set ${envName}=0x... from that FCC deployed-addresses.json file and rerun:`,
      "  pnpm --dir contracts run deploy:fcc-sender:coston2",
      "",
      "The script remains registry-first and will automatically use FlareContractRegistry",
      "once Flare publishes this FCC contract name there.",
    ].join("\n")
  );
}

async function resolveOfficialContract(name, overrideEnvName) {
  const override = process.env[overrideEnvName];
  if (override) {
    console.log(`${name}: using explicit ${overrideEnvName} override`);
    return assertAddress(overrideEnvName, override);
  }

  const registryAddress = assertAddress("FLARE_CONTRACT_REGISTRY_ADDRESS", FLARE_CONTRACT_REGISTRY_ADDRESS);
  const registry = new hre.ethers.Contract(
    registryAddress,
    FLARE_CONTRACT_REGISTRY_ABI,
    hre.ethers.provider
  );
  const resolved = await registry.getContractAddressByName(name);
  console.log(`${name}: resolved via FlareContractRegistry ${registryAddress} -> ${resolved}`);
  if (!isValidAddress(resolved)) {
    throw missingRegistryEntryError(name, overrideEnvName, registryAddress, resolved);
  }
  return assertAddress(name, resolved);
}

async function main() {
  const teeExtensionRegistry = await resolveOfficialContract(
    TEE_EXTENSION_REGISTRY_NAME,
    "TEE_EXTENSION_REGISTRY_ADDRESS"
  );
  const teeMachineRegistry = await resolveOfficialContract(
    TEE_MACHINE_REGISTRY_NAME,
    "TEE_MACHINE_REGISTRY_ADDRESS"
  );
  const [deployer] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();

  console.log("\nDeploying vier official FCC InstructionSender");
  console.log("Network:", hre.network.name, `(${network.chainId})`);
  console.log("Deployer:", deployer.address);
  console.log("FlareContractRegistry:", FLARE_CONTRACT_REGISTRY_ADDRESS);
  console.log("TeeExtensionRegistry:", teeExtensionRegistry);
  console.log("TeeMachineRegistry:", teeMachineRegistry);

  const Sender = await hre.ethers.getContractFactory("VierFCCInstructionSender");
  const sender = await Sender.deploy(teeExtensionRegistry, teeMachineRegistry);
  await sender.waitForDeployment();
  const senderAddress = await sender.getAddress();

  const out = {
    network: hre.network.name,
    chainId: Number(network.chainId),
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    instructionSender: senderAddress,
    flareContractRegistry: FLARE_CONTRACT_REGISTRY_ADDRESS,
    teeExtensionRegistryName: TEE_EXTENSION_REGISTRY_NAME,
    teeMachineRegistryName: TEE_MACHINE_REGISTRY_NAME,
    teeExtensionRegistry,
    teeMachineRegistry,
    opType: "VIER",
    commands: {
      attestMint: "ATTEST_MINT",
      analyzeStrategy: "ANALYZE_STRATEGY"
    },
    note: "Register this sender as the instructions sender for the vier FCC extension, then call setExtensionId()."
  };

  const outPath = path.join(__dirname, "..", "deployments", "coston2-fcc-extension.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));

  console.log("InstructionSender:", senderAddress);
  console.log("Saved to:", outPath);
  console.log("Next: register the extension in TeeExtensionRegistry, then call setExtensionId().\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});