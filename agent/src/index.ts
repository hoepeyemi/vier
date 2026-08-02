// vier Agent Service Entry Point

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { VierAgent } from './agent.js';
import { ContractAddresses } from './blockchain.js';

// Environment validation
interface EnvValidation {
  name: string;
  value: string | undefined;
  required: boolean;
  description: string;
}

function validateEnvironment(addresses: ContractAddresses): { valid: boolean; warnings: string[]; errors: string[] } {
  const warnings: string[] = [];
  const errors: string[] = [];

  const envVars: EnvValidation[] = [
    { name: 'COSTON2_RPC', value: process.env.RPC_URL || process.env.CHAIN_RPC_URL || process.env.COSTON2_RPC || process.env.FLARE_COSTON2_RPC, required: false, description: 'Flare Coston2 RPC endpoint' },
    { name: 'AGENT_PRIVATE_KEY', value: process.env.AGENT_PRIVATE_KEY, required: false, description: 'Agent wallet key' },
    { name: 'QWEN_API_KEY', value: process.env.QWEN_API_KEY, required: false, description: 'Qwen API key' },
    { name: 'WS_PORT', value: process.env.WS_PORT, required: false, description: 'WebSocket port' },
    { name: 'INVOICE_NFT_ADDRESS', value: addresses.invoiceNFT, required: true, description: 'InvoiceNFT contract' },
    { name: 'YIELD_VAULT_ADDRESS', value: addresses.yieldVault, required: true, description: 'YieldVault contract' },
    { name: 'AGENT_ROUTER_ADDRESS', value: addresses.agentRouter, required: true, description: 'AgentRouter contract' },
    { name: 'MOCK_ORACLE_ADDRESS', value: process.env.MOCK_ORACLE_ADDRESS || process.env.PYTH_ORACLE_ADDRESS, required: false, description: 'Oracle contract (MockOracle or PythOracle)' },
  ];

  const zeroAddress = '0x0000000000000000000000000000000000000000';

  for (const env of envVars) {
    if (env.required) {
      if (!env.value || env.value === zeroAddress) {
        errors.push(`${env.name} (${env.description}) is required but not set`);
      }
    } else if (!env.value) {
      warnings.push(`${env.name} (${env.description}) not set, using defaults`);
    }
  }

  // Validate RPC URL format
  const rpcUrl = process.env.RPC_URL || process.env.CHAIN_RPC_URL || process.env.COSTON2_RPC || process.env.FLARE_COSTON2_RPC || 'https://coston2-api.flare.network/ext/C/rpc';
  if (!rpcUrl.startsWith('http://') && !rpcUrl.startsWith('https://')) {
    errors.push('RPC_URL must be a valid HTTP(S) URL');
  }

  // Validate private key format if provided
  const privateKey = process.env.AGENT_PRIVATE_KEY;
  if (privateKey && !/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    warnings.push('AGENT_PRIVATE_KEY must be a 32-byte hex private key (0x + 64 hex chars)');
  }

  // Validate port number
  const wsPort = parseInt(process.env.WS_PORT || '8080');
  if (isNaN(wsPort) || wsPort < 1 || wsPort > 65535) {
    errors.push('WS_PORT must be a valid port number (1-65535)');
  }

  return { valid: errors.length === 0, warnings, errors };
}

function readDeploymentDefaults(networkName: string): Partial<ContractAddresses> {
  const candidates = [
    path.resolve(process.cwd(), 'contracts/deployments', `${networkName}.json`),
    path.resolve(process.cwd(), '..', 'contracts/deployments', `${networkName}.json`),
  ];

  const filePath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!filePath) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as Partial<ContractAddresses>;
  } catch {
    return {};
  }
}

function uniqueUrls(urls: Array<string | undefined>): string[] {
  return [...new Set(urls.filter((url): url is string => Boolean(url)))];
}

function normalizePrivateKey(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  return /^0x[0-9a-fA-F]{64}$/.test(value) ? value : undefined;
}

// Flare Coston2 RPC fallbacks (primary for FCC hackathon)
const COSTON2_RPC_FALLBACKS = uniqueUrls([
  process.env.RPC_URL,
  process.env.CHAIN_RPC_URL,
  process.env.COSTON2_RPC,
  'https://coston2-api.flare.network/ext/C/rpc',
  'https://coston2.enosys.global/ext/C/rpc',
]);


async function selectWorkingRpcUrl(urls: string[]): Promise<string> {
  const timeoutMs = 5000;

  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_chainId',
          params: [],
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.ok) {
        const json = await response.json().catch(() => null);
        if (json?.result) {
          return url;
        }
      }
    } catch {
      // Try the next fallback.
    }
  }

  return urls[0] || 'http://127.0.0.1:8545';
}

// Load configuration from environment
const PRIVATE_KEY = normalizePrivateKey(process.env.AGENT_PRIVATE_KEY);
const QWEN_API_KEY = process.env.QWEN_API_KEY;
const WS_PORT = parseInt(process.env.WS_PORT || '8080');
const DEPLOYMENT_NETWORK = process.env.DEPLOYMENT_NETWORK || 'coston2';
const DEPLOYMENT_DEFAULTS = readDeploymentDefaults(DEPLOYMENT_NETWORK);

// Flare FCE: TEE attestation mode (enabled when FCE_TEE_MODE=true)
const FCE_TEE_MODE = process.env.FCE_TEE_MODE === 'true';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

function cleanAddress(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed === ZERO_ADDRESS) return undefined;
  return trimmed;
}

function sameAddress(a?: string, b?: string): boolean {
  return Boolean(a && b && a.toLowerCase() === b.toLowerCase());
}

const invoiceNFTAddress = cleanAddress(process.env.INVOICE_NFT_ADDRESS) || cleanAddress(DEPLOYMENT_DEFAULTS.invoiceNFT) || ZERO_ADDRESS;
const yieldVaultAddress = cleanAddress(process.env.YIELD_VAULT_ADDRESS) || cleanAddress(DEPLOYMENT_DEFAULTS.yieldVault) || ZERO_ADDRESS;
const agentRouterAddress = cleanAddress(process.env.AGENT_ROUTER_ADDRESS) || cleanAddress(DEPLOYMENT_DEFAULTS.agentRouter) || ZERO_ADDRESS;
const mockOracleAddress = cleanAddress(process.env.MOCK_ORACLE_ADDRESS) || cleanAddress(DEPLOYMENT_DEFAULTS.mockOracle);
const configuredPythOracle = cleanAddress(process.env.PYTH_ORACLE_ADDRESS) || cleanAddress(DEPLOYMENT_DEFAULTS.pythOracle);
const configuredAaveYield = cleanAddress(process.env.AAVE_YIELD_ADDRESS) || cleanAddress(DEPLOYMENT_DEFAULTS.aaveYieldSource);

// PythOracle and AaveYieldSource have different ABIs from MockOracle/YieldVault.
// On Coston2 demo deployments those values are often intentionally blank; never
// treat the mock oracle or the vault as the production integration by address alias.
const pythOracleAddress = sameAddress(configuredPythOracle, mockOracleAddress) ? undefined : configuredPythOracle;
const aaveYieldSourceAddress = sameAddress(configuredAaveYield, yieldVaultAddress) ? undefined : configuredAaveYield;

// Contract addresses (update after deployment)
const ADDRESSES: ContractAddresses = {
  invoiceNFT: invoiceNFTAddress,
  yieldVault: yieldVaultAddress,
  agentRouter: agentRouterAddress,
  mockOracle: mockOracleAddress,
  pythOracle: pythOracleAddress,
  aaveYieldSource: aaveYieldSourceAddress,
};

if (configuredPythOracle && !pythOracleAddress) {
  console.warn('PYTH_ORACLE_ADDRESS points to MockOracle; using MockOracle simulated mode instead.');
}
if (configuredAaveYield && !aaveYieldSourceAddress) {
  console.warn('AAVE_YIELD_ADDRESS points to YieldVault; using simulated yield mode instead.');
}

// Check if using production data sources
const isProduction = !!ADDRESSES.pythOracle || !!ADDRESSES.aaveYieldSource;

async function main() {
  const RPC_URL = await selectWorkingRpcUrl(COSTON2_RPC_FALLBACKS);

  console.log('');
  console.log('  Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€¢â€” Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€¢â€” Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€¢â€”  Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€¢â€”Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€¢â€” Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€¢â€” Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€¢â€” Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€¢â€”   Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€¢â€”');
  console.log('  Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€¢â€Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€“Ë†Ã¢â€“Ë†Ã¢â€¢â€Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€“Ë†Ã¢â€“Ë†Ã¢â€¢â€”Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€¢â€˜ Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€¢â€Ã¢â€¢ÂÃ¢â€¢Å¡Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€“Ë†Ã¢â€“Ë†Ã¢â€¢â€Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€“Ë†Ã¢â€“Ë†Ã¢â€¢â€Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€“Ë†Ã¢â€“Ë†Ã¢â€¢â€”Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€¢â€Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€“Ë†Ã¢â€“Ë†Ã¢â€¢â€”Ã¢â€¢Å¡Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€¢â€” Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€¢â€Ã¢â€¢Â');
  console.log('  Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€¢â€”  Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€¢â€˜Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€¢â€Ã¢â€¢Â    Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€¢â€˜   Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€¢â€˜   Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€¢â€˜Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€¢â€Ã¢â€¢Â Ã¢â€¢Å¡Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€¢â€Ã¢â€¢Â ');
  console.log('  Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€¢â€Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â  Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€¢â€Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€“Ë†Ã¢â€“Ë†Ã¢â€¢â€˜Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€¢â€Ã¢â€¢ÂÃ¢â€“Ë†Ã¢â€“Ë†Ã¢â€¢â€”    Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€¢â€˜   Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€¢â€˜   Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€¢â€˜Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€¢â€Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€“Ë†Ã¢â€“Ë†Ã¢â€¢â€”  Ã¢â€¢Å¡Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€¢â€Ã¢â€¢Â  ');
  console.log('  Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€¢â€˜     Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€¢â€˜  Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€¢â€˜Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€¢â€˜  Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€¢â€”   Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€¢â€˜   Ã¢â€¢Å¡Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€¢â€Ã¢â€¢ÂÃ¢â€“Ë†Ã¢â€“Ë†Ã¢â€¢â€˜  Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€¢â€˜   Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€¢â€˜   ');
  console.log('  Ã¢â€¢Å¡Ã¢â€¢ÂÃ¢â€¢Â     Ã¢â€¢Å¡Ã¢â€¢ÂÃ¢â€¢Â  Ã¢â€¢Å¡Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Å¡Ã¢â€¢ÂÃ¢â€¢Â  Ã¢â€¢Å¡Ã¢â€¢ÂÃ¢â€¢Â   Ã¢â€¢Å¡Ã¢â€¢ÂÃ¢â€¢Â    Ã¢â€¢Å¡Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â Ã¢â€¢Å¡Ã¢â€¢ÂÃ¢â€¢Â  Ã¢â€¢Å¡Ã¢â€¢ÂÃ¢â€¢Â   Ã¢â€¢Å¡Ã¢â€¢ÂÃ¢â€¢Â   ');
  console.log('');

  // Validate environment before starting
  const validation = validateEnvironment(ADDRESSES);

  if (validation.warnings.length > 0) {
    console.log('Ã¢Å¡Â Ã¯Â¸Â  Environment Warnings:');
    validation.warnings.forEach((w) => console.log(`   - ${w}`));
    console.log('');
  }

  if (!validation.valid) {
    console.error('Ã¢ÂÅ’ Environment Validation Failed:');
    validation.errors.forEach((e) => console.error(`   - ${e}`));
    console.error('');
    console.error('Please configure the required environment variables.');
    console.error('See .env.example for reference.');
    process.exit(1);
  }
  console.log('  x402 AI-Managed B2B Payments');
  console.log('');
  console.log('='.repeat(60));
  console.log(`  Ã°Å¸â€œÂ¡ RPC:     ${RPC_URL}`);
  console.log(`  Ã°Å¸â€Å’ WS:      ws://localhost:${WS_PORT}`);
  console.log(`  Ã°Å¸â€â€˜ Wallet:  ${PRIVATE_KEY ? 'Ã¢Å“â€¦ Configured' : 'Ã¢ÂÅ’ Read-only mode'}`);
  console.log(`  Ã°Å¸Â¤â€“ LLM:     ${QWEN_API_KEY ? 'Ã¢Å“â€¦ AI (Real)' : 'Ã¢Å¡Â¡ Template mode'}`);
  console.log(`  Ã°Å¸â€Â FCE TEE: ${FCE_TEE_MODE ? 'Ã¢Å“â€¦ Flare Confidential Compute' : 'Ã¢Å¡Â Ã¯Â¸Â  Standard mode'}`);
  console.log('='.repeat(60));
  console.log('');
  console.log('  Data Sources:');
  console.log(`  Ã°Å¸â€œÅ  Oracle: ${ADDRESSES.pythOracle ? 'Ã¢Å“â€¦ Pyth Network (Real-time)' : 'Ã¢Å¡Â Ã¯Â¸Â  Mock Oracle (Simulated)'}`);
  console.log(`  Ã°Å¸â€™Â° Yield: ${ADDRESSES.aaveYieldSource ? 'Ã¢Å“â€¦ Flare Vault (Real DeFi)' : 'Ã¢Å¡Â Ã¯Â¸Â  Simulated Yield'}`);
  if (!isProduction) {
    console.log('');
    console.log('  Ã¢Å¡Â Ã¯Â¸Â  Running with SIMULATED data for demo.');
    console.log('  Set PYTH_ORACLE_ADDRESS for production oracle price feeds.');
  }
  console.log('='.repeat(60));

  // Validate contract addresses
  if (ADDRESSES.invoiceNFT === ZERO_ADDRESS) {
    console.warn('\nÃ¢Å¡Â Ã¯Â¸Â  Contract addresses not configured.');
    console.log('   Set environment variables after deployment.\n');
  }

  // Create agent instance
  const agent = new VierAgent(RPC_URL, ADDRESSES, {
    privateKey: PRIVATE_KEY,
    qwenApiKey: QWEN_API_KEY,
    wsPort: WS_PORT,
    teeMode: FCE_TEE_MODE,
    config: {
      minConfidence: 70,
      analysisInterval: 30000, // 30 seconds
      maxConcurrentAnalyses: 5,
      autoExecute: !!PRIVATE_KEY, // Only auto-execute if we have a key
    },
  });

  // Start the agent
  await agent.start();

  // Health check is now built into WebSocket server (same port)
  console.log(`  Ã°Å¸ÂÂ¥ Health: http://localhost:${WS_PORT}/health`);

  // Handle graceful shutdown
  const shutdown = () => {
    console.log('\nÃ°Å¸â€ºâ€˜ Shutting down vier Agent...');
    agent.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Keep process alive
  console.log('\nÃ¢Å“â€¦ vier Agent is live. Press Ctrl+C to stop.\n');
}

// Run
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
