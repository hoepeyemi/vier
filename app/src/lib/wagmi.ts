import { http, createConfig } from 'wagmi';
import { mainnet, base, arbitrum, polygon, bsc } from 'wagmi/chains';
import { defineChain } from 'viem';
import { injected, walletConnect } from 'wagmi/connectors';
import { createCoston2Transport, getCoston2RpcUrls } from './coston2-rpc';

export {
  getContractAddresses,
  getInvoiceNFTAddress,
  getYieldVaultAddress,
  getAgentRouterAddress,
  areContractsDeployed,
  getChainMeta,
  CHAIN_IDS,
  SUPPORTED_MAINNET_CHAINS,
  SUPPORTED_TESTNET_CHAINS,
} from './contracts/addresses';

export type { ContractAddresses, ChainMeta } from './contracts/addresses';

export const anvil = defineChain({
  id: 31337,
  name: 'Anvil Local',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['http://127.0.0.1:8545'] } },
});

export const skaleEuropa = defineChain({
  id: 2046399126,
  name: 'SKALE Europa',
  nativeCurrency: { name: 'sFUEL', symbol: 'sFUEL', decimals: 18 },
  rpcUrls: { default: { http: ['https://mainnet.skalenodes.com/v1/elated-tan-skat'] } },
  blockExplorers: {
    default: {
      name: 'SKALE Explorer',
      url: 'https://elated-tan-skat.explorer.mainnet.skalenodes.com',
    },
  },
});

export const flareCoston2 = defineChain({
  id: 114,
  name: 'Flare Coston2',
  nativeCurrency: { name: 'Coston2 Flare', symbol: 'C2FLR', decimals: 18 },
  rpcUrls: {
    default: { http: getCoston2RpcUrls() },
    public: { http: getCoston2RpcUrls() },
  },
  blockExplorers: {
    default: {
      name: 'Coston2 Explorer',
      url: 'https://coston2-explorer.flare.network',
    },
  },
  contracts: {
    multicall3: { address: '0xcA11bde05977b3631167028862bE2a173976CA11' },
  },
  testnet: true,
});

export const flare = defineChain({
  id: 14,
  name: 'Flare',
  nativeCurrency: { name: 'Flare', symbol: 'FLR', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://flare-api.flare.network/ext/C/rpc'] },
    public: { http: ['https://flare-api.flare.network/ext/C/rpc', 'https://flare.enosys.global/ext/C/rpc'] },
  },
  blockExplorers: {
    default: {
      name: 'Flare Explorer',
      url: 'https://flare-explorer.flare.network',
    },
  },
});

const isTestnet = process.env.NEXT_PUBLIC_NETWORK_MODE !== 'mainnet';
const mainnetChains = [mainnet, bsc, base, arbitrum, polygon, skaleEuropa, flare] as const;
const testnetChains = [flareCoston2] as const;
const devChains = [anvil] as const;
const isDev = process.env.NODE_ENV === 'development';

export const config = createConfig({
  chains: [...(isTestnet ? testnetChains : mainnetChains), ...(isDev ? devChains : [])],
  connectors: [
    injected({ shimDisconnect: true }),
    walletConnect({
      projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '',
      showQrModal: true,
    }),
  ],
  transports: {
    [mainnet.id]: http(process.env.NEXT_PUBLIC_ETH_RPC || undefined),
    [bsc.id]: http(process.env.NEXT_PUBLIC_BSC_RPC || 'https://bsc-dataseed.binance.org'),
    [base.id]: http(process.env.NEXT_PUBLIC_BASE_RPC || undefined),
    [arbitrum.id]: http(process.env.NEXT_PUBLIC_ARBITRUM_RPC || undefined),
    [polygon.id]: http(process.env.NEXT_PUBLIC_POLYGON_RPC || undefined),
    [skaleEuropa.id]: http('https://mainnet.skalenodes.com/v1/elated-tan-skat'),
    [flare.id]: http(process.env.NEXT_PUBLIC_FLARE_RPC || 'https://flare-api.flare.network/ext/C/rpc'),
    [flareCoston2.id]: createCoston2Transport(),
    [anvil.id]: http('http://127.0.0.1:8545'),
  },
});

export const AGENT_WS_URL = process.env.NEXT_PUBLIC_AGENT_WS_URL || 'ws://localhost:8080';

export const SUPPORTED_CHAINS = isTestnet
  ? testnetChains.map(c => c.id)
  : mainnetChains.map(c => c.id);