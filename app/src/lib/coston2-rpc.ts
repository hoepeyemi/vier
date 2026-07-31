import { fallback, http } from "viem"

function uniqueUrls(urls: Array<string | undefined>): string[] {
  return [...new Set(urls.filter((url): url is string => Boolean(url)))]
}

export function getCoston2RpcUrls(): string[] {
  return uniqueUrls([
    process.env.NEXT_PUBLIC_COSTON2_RPC,
    process.env.NEXT_PUBLIC_FLARE_COSTON2_RPC,
    process.env.NEXT_PUBLIC_CHAIN_RPC_URL,
    process.env.NEXT_PUBLIC_RPC_URL,
    "https://coston2-api.flare.network/ext/C/rpc",
    "https://coston2.enosys.global/ext/C/rpc",
  ])
}

export function createCoston2Transport() {
  const urls = getCoston2RpcUrls()
  return fallback(urls.map((url) => http(url)))
}