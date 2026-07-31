require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-chai-matchers");

const fs = require("fs");
const path = require("path");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const equalsIndex = line.indexOf("=");
    if (equalsIndex === -1) continue;

    const key = line.slice(0, equalsIndex).trim();
    if (!key || process.env[key] !== undefined) continue;

    let value = line.slice(equalsIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFile(path.join(__dirname, ".env"));
loadEnvFile(path.join(__dirname, ".env.local"));
loadEnvFile(path.join(__dirname, "..", ".env"));

const COSTON2_RPC_FALLBACKS = [
  process.env.COSTON2_RPC,
  process.env.FLARE_COSTON2_RPC,
  process.env.CHAIN_RPC_URL,
  "https://coston2-api.flare.network/ext/C/rpc",
  "https://coston2.enosys.global/ext/C/rpc",
].filter(Boolean);

const optimizerSettings = {
  optimizer: { enabled: true, runs: 1 },
  evmVersion: "cancun",
  viaIR: true,
};

const PRIVATE_KEY = process.env.PRIVATE_KEY && process.env.PRIVATE_KEY !== "your_private_key_here"
  ? [process.env.PRIVATE_KEY]
  : [];

module.exports = {
  solidity: {
    version: "0.8.26",
    settings: optimizerSettings,
  },
  networks: {
    coston2: {
      url: COSTON2_RPC_FALLBACKS[0] || "https://coston2-api.flare.network/ext/C/rpc",
      chainId: 114,
      accounts: PRIVATE_KEY,
      gasPrice: "auto",
    },
  },
  paths: {
    sources: "./src",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  mocha: { timeout: 120000 },
};