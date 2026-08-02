import { NextResponse } from "next/server"
import {
  encodeAbiParameters,
  encodePacked,
  getAddress,
  isAddress,
  keccak256,
  parseAbiParameters,
  verifyMessage,
  type Hex,
} from "viem"
import { privateKeyToAccount } from "viem/accounts"

const DEFAULT_FCE_IMAGE_HASH = "0x7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069" as const
const DEFAULT_FLARE_CHAIN_ID = BigInt(114)
const RATE_LIMIT_WINDOW_MS = 60_000
const MAX_ATTESTATIONS_PER_WINDOW = 6

const issuerWindows = new Map<string, number[]>()

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

function isBytes32(value: unknown): value is Hex {
  return typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value)
}

function getSigningKey(): Hex | null {
  const key = process.env.FLARE_FCE_IDENTITY_KEY
  if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) return null
  return key as Hex
}

function getTeeId(): Hex {
  if (isBytes32(process.env.FLARE_TEE_ID)) return process.env.FLARE_TEE_ID

  const imageHash = isBytes32(process.env.FCE_IMAGE_HASH) ? process.env.FCE_IMAGE_HASH : DEFAULT_FCE_IMAGE_HASH
  const chainId = BigInt(process.env.FLARE_CHAIN_ID || DEFAULT_FLARE_CHAIN_ID)
  return keccak256(encodePacked(["bytes32", "uint256"], [imageHash, chainId]))
}

function buildIssuerMessage(params: {
  issuer: string
  dataCommitment: Hex
  amountCommitment: Hex
  encryptedInvoiceHash: Hex
  dueDate: string
  requestNonce: string
}) {
  return [
    "vier FCC encrypted invoice mint",
    `issuer=${getAddress(params.issuer)}`,
    `dataCommitment=${params.dataCommitment}`,
    `amountCommitment=${params.amountCommitment}`,
    `encryptedInvoiceHash=${params.encryptedInvoiceHash}`,
    `dueDate=${params.dueDate}`,
    `requestNonce=${params.requestNonce}`,
  ].join("\n")
}

function checkRateLimit(issuer: string) {
  const now = Date.now()
  const cutoff = now - RATE_LIMIT_WINDOW_MS
  const current = (issuerWindows.get(issuer) || []).filter((ts) => ts > cutoff)
  if (current.length >= MAX_ATTESTATIONS_PER_WINDOW) return false
  current.push(now)
  issuerWindows.set(issuer, current)
  return true
}

export async function POST(request: Request) {
  const signingKey = getSigningKey()
  if (!signingKey) {
    return jsonError("FLARE_FCE_IDENTITY_KEY is required for FCC mint attestation", 503)
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return jsonError("Invalid JSON body")
  }

  const { issuer, dataCommitment, amountCommitment, encryptedInvoiceHash, dueDate, requestNonce, issuerSignature } = body
  if (typeof issuer !== "string" || !isAddress(issuer)) return jsonError("Invalid issuer")
  const normalizedIssuer = getAddress(issuer)
  if (!isBytes32(dataCommitment)) return jsonError("Invalid dataCommitment")
  if (!isBytes32(amountCommitment)) return jsonError("Invalid amountCommitment")
  if (!isBytes32(encryptedInvoiceHash)) return jsonError("Invalid encryptedInvoiceHash")
  if (typeof requestNonce !== "string" || !/^0x[0-9a-fA-F]{32}$/.test(requestNonce)) return jsonError("Invalid requestNonce")
  if (typeof issuerSignature !== "string" || !/^0x[0-9a-fA-F]+$/.test(issuerSignature)) return jsonError("Invalid issuerSignature")

  const dueDateBigInt = typeof dueDate === "string" || typeof dueDate === "number" ? BigInt(dueDate) : null
  if (!dueDateBigInt || dueDateBigInt <= BigInt(Math.floor(Date.now() / 1000))) {
    return jsonError("Due date must be in the future")
  }

  if (!checkRateLimit(normalizedIssuer)) {
    return jsonError("FCC mint attestation rate limit exceeded", 429)
  }

  const issuerMessage = buildIssuerMessage({
    issuer: normalizedIssuer,
    dataCommitment,
    amountCommitment,
    encryptedInvoiceHash,
    dueDate: dueDateBigInt.toString(),
    requestNonce,
  })

  const signatureValid = await verifyMessage({
    address: normalizedIssuer,
    message: issuerMessage,
    signature: issuerSignature as Hex,
  })
  if (!signatureValid) return jsonError("Issuer signature did not authorize this FCC mint request", 401)

  const teeId = getTeeId()
  const nonce = BigInt(requestNonce)
  const timestamp = BigInt(Math.floor(Date.now() / 1000))
  const payload = encodeAbiParameters(
    parseAbiParameters("address issuer, bytes32 dataCommitment, bytes32 amountCommitment, bytes32 encryptedInvoiceHash, uint256 dueDate, uint256 nonce, uint256 timestamp"),
    [normalizedIssuer, dataCommitment, amountCommitment, encryptedInvoiceHash, dueDateBigInt, nonce, timestamp],
  )

  const account = privateKeyToAccount(signingKey)
  const digest = keccak256(encodePacked(["bytes32", "bytes"], [teeId, payload]))
  const signature = await account.signMessage({ message: { raw: digest } })

  return NextResponse.json({
    teeId,
    payload,
    signature,
    nonce: nonce.toString(),
    timestamp: timestamp.toString(),
    issuerMessage,
  })
}