// Contract addresses for vier
import { isAddress } from 'viem'

export const CHAIN_IDS = {
  ETHEREUM: 1,
  BSC: 56,
  POLYGON: 137,
  BASE: 8453,
  ARBITRUM: 42161,
  SKALE: 2046399126,
  FLARE: 14,
  FLARE_COSTON2: 114,
  BSC_TESTNET: 97,
  POLYGON_AMOY: 80002,
  ARBITRUM_SEPOLIA: 421614,
  SKALE_TESTNET: 1444673419,
  LOCAL: 31337,
} as const

type ChainId = (typeof CHAIN_IDS)[keyof typeof CHAIN_IDS]

export type ContractAddresses = {
  invoiceNFT: `0x${string}`
  yieldVault: `0x${string}`
  agentRouter: `0x${string}`
  privacyRegistry: `0x${string}`
  ftsoV2: `0x${string}`
  ftsoOracle: `0x${string}`
  aaveYieldSource: `0x${string}`
  mockFDCVerifier: `0x${string}`
}

const ZERO = "0x0000000000000000000000000000000000000000" as `0x${string}`

const emptyAddresses: ContractAddresses = {
  invoiceNFT: ZERO,
  yieldVault: ZERO,
  agentRouter: ZERO,
  privacyRegistry: ZERO,
  ftsoV2: ZERO,
  ftsoOracle: ZERO,
  aaveYieldSource: ZERO,
  mockFDCVerifier: ZERO,
}

const addresses: Partial<Record<ChainId, ContractAddresses>> = {
  [CHAIN_IDS.FLARE_COSTON2]: {
    invoiceNFT: (process.env.NEXT_PUBLIC_COSTON2_INVOICE_NFT || process.env.NEXT_PUBLIC_INVOICE_NFT_ADDRESS || "0x7481aeE59C35bb08c4F4B0DC4DE0C0A143c9d7b7") as `0x${string}`,
    yieldVault: (process.env.NEXT_PUBLIC_COSTON2_YIELD_VAULT || process.env.NEXT_PUBLIC_YIELD_VAULT_ADDRESS || "0xfDa39D8a75391aAec43BB54a774bf6F03A0033b6") as `0x${string}`,
    agentRouter: (process.env.NEXT_PUBLIC_COSTON2_AGENT_ROUTER || process.env.NEXT_PUBLIC_AGENT_ROUTER_ADDRESS || "0x95116249980028E240403477E41dF44e12968AC5") as `0x${string}`,
    privacyRegistry: (process.env.NEXT_PUBLIC_COSTON2_PRIVACY_REGISTRY || process.env.NEXT_PUBLIC_PRIVACY_REGISTRY_ADDRESS || "0xc08B41ACeD118665d08b9517c812db483245791C") as `0x${string}`,
    ftsoV2: (process.env.NEXT_PUBLIC_COSTON2_FTSO_V2 || "0xC4e9c78EA53db782E28f28Fdf80BaF59336B304d") as `0x${string}`,
    ftsoOracle: (process.env.NEXT_PUBLIC_COSTON2_FTSO_ORACLE || "0xCc351f611b89607e25ab124D3abF58A83ADf94a9") as `0x${string}`,
    aaveYieldSource: (process.env.NEXT_PUBLIC_COSTON2_AAVE_YIELD_SOURCE || ZERO) as `0x${string}`,
    mockFDCVerifier: (process.env.NEXT_PUBLIC_COSTON2_MOCK_FDC_VERIFIER || "0x4FE685b35c3A1B9b297eF7D1465C49b5d859daE9") as `0x${string}`,
  },
  [CHAIN_IDS.FLARE]: { ...emptyAddresses },
  [CHAIN_IDS.ARBITRUM_SEPOLIA]: { ...emptyAddresses },
  [CHAIN_IDS.POLYGON_AMOY]: { ...emptyAddresses },
  [CHAIN_IDS.ETHEREUM]: { ...emptyAddresses },
  [CHAIN_IDS.BSC]: { ...emptyAddresses },
  [CHAIN_IDS.BASE]: { ...emptyAddresses },
  [CHAIN_IDS.ARBITRUM]: { ...emptyAddresses },
  [CHAIN_IDS.POLYGON]: { ...emptyAddresses },
  [CHAIN_IDS.SKALE]: { ...emptyAddresses, ftsoV2: ZERO, aaveYieldSource: ZERO },
  [CHAIN_IDS.LOCAL]: {
    invoiceNFT: (process.env.NEXT_PUBLIC_INVOICE_NFT_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3") as `0x${string}`,
    yieldVault: (process.env.NEXT_PUBLIC_YIELD_VAULT_ADDRESS || "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512") as `0x${string}`,
    agentRouter: (process.env.NEXT_PUBLIC_AGENT_ROUTER_ADDRESS || "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9") as `0x${string}`,
    privacyRegistry: (process.env.NEXT_PUBLIC_PRIVACY_REGISTRY_ADDRESS || "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0") as `0x${string}`,
    ftsoV2: ZERO,
  ftsoOracle: ZERO,
    aaveYieldSource: ZERO,
    mockFDCVerifier: ZERO,
  },
}

export type ChainMeta = {
  name: string
  shortName: string
  hasAave: boolean
  hasFtso: boolean
  gasLabel: string
  explorerUrl: string
  nativeCurrency: string
}

export const CHAIN_META: Partial<Record<ChainId, ChainMeta>> = {
  [CHAIN_IDS.FLARE]: {
    name: "Flare", shortName: "FLR", hasAave: false, hasFtso: true,
    gasLabel: "~$0.01", explorerUrl: "https://flare-explorer.flare.network", nativeCurrency: "FLR",
  },
  [CHAIN_IDS.FLARE_COSTON2]: {
    name: "Flare Coston2", shortName: "C2FLR", hasAave: false, hasFtso: true,
    gasLabel: "~$0", explorerUrl: "https://coston2-explorer.flare.network", nativeCurrency: "C2FLR",
  },
  [CHAIN_IDS.ETHEREUM]: {
    name: "Ethereum", shortName: "ETH", hasAave: true, hasFtso: false,
    gasLabel: "~$2-10", explorerUrl: "https://etherscan.io", nativeCurrency: "ETH",
  },
  [CHAIN_IDS.BSC]: {
    name: "BNB Chain", shortName: "BSC", hasAave: true, hasFtso: false,
    gasLabel: "~$0.05", explorerUrl: "https://bscscan.com", nativeCurrency: "BNB",
  },
  [CHAIN_IDS.BASE]: {
    name: "Base", shortName: "BASE", hasAave: true, hasFtso: false,
    gasLabel: "~$0.01", explorerUrl: "https://basescan.org", nativeCurrency: "ETH",
  },
  [CHAIN_IDS.ARBITRUM]: {
    name: "Arbitrum", shortName: "ARB", hasAave: true, hasFtso: false,
    gasLabel: "~$0.01", explorerUrl: "https://arbiscan.io", nativeCurrency: "ETH",
  },
  [CHAIN_IDS.POLYGON]: {
    name: "Polygon", shortName: "MATIC", hasAave: true, hasFtso: false,
    gasLabel: "~$0.01", explorerUrl: "https://polygonscan.com", nativeCurrency: "POL",
  },
  [CHAIN_IDS.SKALE]: {
    name: "SKALE Europa", shortName: "SKALE", hasAave: false, hasFtso: false,
    gasLabel: "FREE", explorerUrl: "https://elated-tan-skat.explorer.mainnet.skalenodes.com", nativeCurrency: "sFUEL",
  },
  [CHAIN_IDS.ARBITRUM_SEPOLIA]: {
    name: "Arbitrum Testnet", shortName: "A-TEST", hasAave: true, hasFtso: false,
    gasLabel: "~$0", explorerUrl: "https://sepolia.arbiscan.io", nativeCurrency: "ETH",
  },
  [CHAIN_IDS.POLYGON_AMOY]: {
    name: "Polygon Amoy", shortName: "P-AMOY", hasAave: true, hasFtso: false,
    gasLabel: "~$0", explorerUrl: "https://amoy.polygonscan.com", nativeCurrency: "POL",
  },
}

export const SUPPORTED_MAINNET_CHAINS = [
  CHAIN_IDS.ETHEREUM, CHAIN_IDS.BSC, CHAIN_IDS.BASE,
  CHAIN_IDS.ARBITRUM, CHAIN_IDS.POLYGON, CHAIN_IDS.SKALE, CHAIN_IDS.FLARE,
] as const

export const SUPPORTED_TESTNET_CHAINS = [CHAIN_IDS.FLARE_COSTON2] as const

export function getContractAddresses(chainId: number): ContractAddresses {
  return addresses[chainId as ChainId] || emptyAddresses
}

export function getInvoiceNFTAddress(chainId: number): `0x${string}` {
  return getContractAddresses(chainId).invoiceNFT
}

export function getYieldVaultAddress(chainId: number): `0x${string}` {
  return getContractAddresses(chainId).yieldVault
}

export function getAgentRouterAddress(chainId: number): `0x${string}` {
  return getContractAddresses(chainId).agentRouter
}

export function areContractsDeployed(chainId: number): boolean {
  const addrs = getContractAddresses(chainId)
  return addrs.invoiceNFT !== ZERO && addrs.yieldVault !== ZERO && addrs.agentRouter !== ZERO
}

export function getChainMeta(chainId: number): ChainMeta | undefined {
  return CHAIN_META[chainId as ChainId]
}

export function isValidContractAddress(address: string): boolean {
  if (!address) return false
  if (address === ZERO) return false
  return isAddress(address)
}

export function validateContractAddresses(chainId: number): { valid: boolean; errors: string[] } {
  const addrs = getContractAddresses(chainId)
  const errors: string[] = []

  if (!isValidContractAddress(addrs.invoiceNFT)) errors.push(`InvoiceNFT address is invalid: ${addrs.invoiceNFT}`)
  if (!isValidContractAddress(addrs.yieldVault)) errors.push(`YieldVault address is invalid: ${addrs.yieldVault}`)
  if (!isValidContractAddress(addrs.agentRouter)) errors.push(`AgentRouter address is invalid: ${addrs.agentRouter}`)

  return { valid: errors.length === 0, errors }
}