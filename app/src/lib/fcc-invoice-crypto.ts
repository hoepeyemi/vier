import { keccak256, toHex } from "viem"

const ENCRYPTION_VERSION = "vier.invoice.v1"
const STORAGE_PREFIX = "vier:encrypted-invoice:"

type EncryptedInvoiceEnvelope = {
  version: typeof ENCRYPTION_VERSION
  algorithm: "AES-GCM-256"
  keyJwk: JsonWebKey
  iv: `0x${string}`
  ciphertext: `0x${string}`
  ciphertextHash: `0x${string}`
  createdAt: string
}

function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length))
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

function bytesToHex(bytes: Uint8Array): `0x${string}` {
  return toHex(bytes) as `0x${string}`
}

function hexToBytes(hex: `0x${string}`): Uint8Array {
  const normalized = hex.slice(2)
  const out = new Uint8Array(normalized.length / 2)
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(normalized.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

export async function encryptInvoicePayload(invoiceJson: string): Promise<EncryptedInvoiceEnvelope> {
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"])
  const iv = randomBytes(12)
  const plaintext = new TextEncoder().encode(invoiceJson)
  const ciphertextBuffer = await crypto.subtle.encrypt({ name: "AES-GCM", iv: toArrayBuffer(iv) }, key, toArrayBuffer(plaintext))
  const ciphertext = bytesToHex(new Uint8Array(ciphertextBuffer))
  const keyJwk = await crypto.subtle.exportKey("jwk", key)

  return {
    version: ENCRYPTION_VERSION,
    algorithm: "AES-GCM-256",
    keyJwk,
    iv: bytesToHex(iv),
    ciphertext,
    ciphertextHash: keccak256(ciphertext),
    createdAt: new Date().toISOString(),
  }
}

export async function decryptInvoicePayload(envelope: EncryptedInvoiceEnvelope): Promise<string> {
  if (envelope.version !== ENCRYPTION_VERSION || envelope.algorithm !== "AES-GCM-256") {
    throw new Error("Unsupported encrypted invoice envelope")
  }

  const key = await crypto.subtle.importKey("jwk", envelope.keyJwk, { name: "AES-GCM" }, false, ["decrypt"])
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(hexToBytes(envelope.iv)) },
    key,
    toArrayBuffer(hexToBytes(envelope.ciphertext)),
  )
  return new TextDecoder().decode(plaintext)
}

export function storeEncryptedInvoiceDraft(txHash: `0x${string}`, envelope: EncryptedInvoiceEnvelope) {
  localStorage.setItem(`${STORAGE_PREFIX}tx:${txHash}`, JSON.stringify(envelope))
}

export function promoteEncryptedInvoiceDraft(txHash: `0x${string}`, tokenId: string) {
  const key = `${STORAGE_PREFIX}tx:${txHash}`
  const value = localStorage.getItem(key)
  if (!value) return
  localStorage.setItem(`${STORAGE_PREFIX}token:${tokenId}`, value)
  localStorage.removeItem(key)
}

export function loadEncryptedInvoice(tokenId: string): EncryptedInvoiceEnvelope | null {
  const raw = localStorage.getItem(`${STORAGE_PREFIX}token:${tokenId}`)
  if (!raw) return null
  try {
    return JSON.parse(raw) as EncryptedInvoiceEnvelope
  } catch {
    return null
  }
}

export function buildFCCMintAuthorizationMessage(params: {
  issuer: string
  dataCommitment: `0x${string}`
  amountCommitment: `0x${string}`
  encryptedInvoiceHash: `0x${string}`
  dueDate: string
  requestNonce: `0x${string}`
}) {
  return [
    "vier FCC encrypted invoice mint",
    `issuer=${params.issuer}`,
    `dataCommitment=${params.dataCommitment}`,
    `amountCommitment=${params.amountCommitment}`,
    `encryptedInvoiceHash=${params.encryptedInvoiceHash}`,
    `dueDate=${params.dueDate}`,
    `requestNonce=${params.requestNonce}`,
  ].join("\n")
}
export type { EncryptedInvoiceEnvelope }