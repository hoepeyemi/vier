export const FLARE_CONTRACT_REGISTRY_ADDRESS = "0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019" as const
export const TEE_EXTENSION_REGISTRY_NAME = "TeeExtensionRegistry"
export const TEE_MACHINE_REGISTRY_NAME = "TeeMachineRegistry"
export const VIER_FCC_OP_TYPE = "VIER"
export const VIER_FCC_COMMAND_ATTEST_MINT = "ATTEST_MINT"
export const VIER_FCC_COMMAND_ANALYZE_STRATEGY = "ANALYZE_STRATEGY"

export type FCCProxyInfo = {
  machineData?: {
    codeHash?: string
    extensionId?: string | number
    initialOwner?: string
  }
  [key: string]: unknown
}

export type FCCActionResult = {
  status?: number
  log?: string
  data?: unknown
  [key: string]: unknown
}

function getProxyUrl() {
  return process.env.FCC_EXT_PROXY_URL || process.env.EXT_PROXY_URL || ""
}

export function getFlareContractRegistryAddress() {
  return process.env.FLARE_CONTRACT_REGISTRY_ADDRESS || FLARE_CONTRACT_REGISTRY_ADDRESS
}

export function getOfficialFCCRegistryNames() {
  return {
    teeExtensionRegistry: process.env.TEE_EXTENSION_REGISTRY_NAME || TEE_EXTENSION_REGISTRY_NAME,
    teeMachineRegistry: process.env.TEE_MACHINE_REGISTRY_NAME || TEE_MACHINE_REGISTRY_NAME,
  }
}
export function isOfficialFCCProxyConfigured() {
  return getProxyUrl().length > 0
}

export async function fetchFCCProxyInfo(): Promise<FCCProxyInfo> {
  const proxyUrl = getProxyUrl()
  if (!proxyUrl) throw new Error("FCC_EXT_PROXY_URL is not configured")

  const response = await fetch(`${proxyUrl.replace(/\/$/, "")}/info`, { cache: "no-store" })
  if (!response.ok) throw new Error(`FCC proxy /info failed: ${response.status}`)
  return response.json() as Promise<FCCProxyInfo>
}