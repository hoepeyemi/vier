// QuickBooks API integration utilities
// Uses OAuth 2.0 for authentication

const QUICKBOOKS_BASE_URL = process.env.QUICKBOOKS_ENVIRONMENT === "production"
  ? "https://quickbooks.api.intuit.com"
  : "https://sandbox-quickbooks.api.intuit.com"

const OAUTH_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer"

export const QUICKBOOKS_AUTH_URL = OAUTH_TOKEN_URL
export const QUICKBOOKS_AUTHORIZE_URL = "https://appcenter.intuit.com/connect/oauth2"

export const QUICKBOOKS_SCOPES = [
  "com.intuit.quickbooks.accounting",
].join(" ")

function sanitizeQuickBooksLog(value: string): string {
  return value
    .replace(/"access_token"\s*:\s*"[^"]+"/gi, '"access_token":"[redacted]"')
    .replace(/"refresh_token"\s*:\s*"[^"]+"/gi, '"refresh_token":"[redacted]"')
    .replace(/access_token=[^&\s]+/gi, 'access_token=[redacted]')
    .replace(/refresh_token=[^&\s]+/gi, 'refresh_token=[redacted]')
    .replace(/client_secret=[^&\s]+/gi, 'client_secret=[redacted]')
    .replace(/code=[^&\s]+/gi, 'code=[redacted]')
}

function logQuickBooksClient(message: string, data?: Record<string, unknown>) {
  console.log(`[quickbooks:client] ${message}`, data || "")
}

export interface QuickBooksTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
  tokenType: string
  realmId: string
  expiresAt: number
}

export interface QuickBooksInvoice {
  Id: string
  DocNumber: string
  CustomerRef: {
    value: string
    name: string
  }
  TotalAmt: number
  Balance: number
  DueDate: string
  TxnDate: string
  EmailStatus: string
  BillEmail?: {
    Address: string
  }
  Line: Array<{
    Description: string
    Amount: number
    DetailType: string
    SalesItemLineDetail?: {
      ItemRef: {
        value: string
        name: string
      }
      Qty: number
      UnitPrice: number
    }
  }>
}

export function getAuthorizationUrl(state: string): string {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID
  const redirectUri = process.env.QUICKBOOKS_REDIRECT_URI

  if (!clientId || !redirectUri) {
    throw new Error("QuickBooks OAuth configuration missing")
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: QUICKBOOKS_SCOPES,
    state,
  })

  logQuickBooksClient("authorization URL generated", {
    environment: process.env.QUICKBOOKS_ENVIRONMENT || "sandbox",
    redirectUri,
    scope: QUICKBOOKS_SCOPES,
    hasClientId: Boolean(clientId),
  })

  return `${QUICKBOOKS_AUTHORIZE_URL}?${params.toString()}`
}

export async function exchangeCodeForTokens(
  code: string,
  realmId: string
): Promise<QuickBooksTokens> {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET
  const redirectUri = process.env.QUICKBOOKS_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("QuickBooks OAuth configuration missing")
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64")

  logQuickBooksClient("token exchange request", {
    url: QUICKBOOKS_AUTH_URL,
    redirectUri,
    hasClientId: Boolean(clientId),
    hasClientSecret: Boolean(clientSecret),
    hasCode: Boolean(code),
    realmId,
  })

  const response = await fetch(QUICKBOOKS_AUTH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  })

  logQuickBooksClient("token exchange response", { status: response.status, ok: response.ok })

  if (!response.ok) {
    const error = sanitizeQuickBooksLog(await response.text())
    logQuickBooksClient("token exchange error body", { error: error.slice(0, 500) })
    throw new Error(`Token exchange failed: ${error}`)
  }

  const data = await response.json()
  logQuickBooksClient("token exchange parsed", {
    hasAccessToken: Boolean(data.access_token),
    hasRefreshToken: Boolean(data.refresh_token),
    expiresIn: data.expires_in,
    tokenType: data.token_type,
  })

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    tokenType: data.token_type,
    realmId,
    expiresAt: Date.now() + data.expires_in * 1000,
  }
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<QuickBooksTokens> {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error("QuickBooks OAuth configuration missing")
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64")

  logQuickBooksClient("refresh token request", {
    url: QUICKBOOKS_AUTH_URL,
    hasClientId: Boolean(clientId),
    hasClientSecret: Boolean(clientSecret),
    hasRefreshToken: Boolean(refreshToken),
  })

  const response = await fetch(QUICKBOOKS_AUTH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  })

  logQuickBooksClient("refresh token response", { status: response.status, ok: response.ok })

  if (!response.ok) {
    const error = sanitizeQuickBooksLog(await response.text())
    logQuickBooksClient("refresh token error body", { error: error.slice(0, 500) })
    throw new Error(`Token refresh failed: ${error}`)
  }

  const data = await response.json()

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    tokenType: data.token_type,
    realmId: "",
    expiresAt: Date.now() + data.expires_in * 1000,
  }
}

export async function fetchInvoices(
  accessToken: string,
  realmId: string,
  options?: {
    status?: "open" | "paid" | "all"
    limit?: number
  }
): Promise<QuickBooksInvoice[]> {
  const { status = "open", limit = 100 } = options || {}

  let query = `SELECT * FROM Invoice`

  if (status === "open") {
    query += ` WHERE Balance > 0`
  } else if (status === "paid") {
    query += ` WHERE Balance = 0`
  }

  query += ` MAXRESULTS ${limit}`

  const encodedQuery = encodeURIComponent(query)
  const url = `${QUICKBOOKS_BASE_URL}/v3/company/${realmId}/query?query=${encodedQuery}`

  logQuickBooksClient("fetch invoices request", {
    environment: process.env.QUICKBOOKS_ENVIRONMENT || "sandbox",
    realmId,
    status,
    limit,
    query,
    hasAccessToken: Boolean(accessToken),
  })

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  })

  logQuickBooksClient("fetch invoices response", { status: response.status, ok: response.ok })

  if (!response.ok) {
    const error = sanitizeQuickBooksLog(await response.text())
    logQuickBooksClient("fetch invoices error body", { error: error.slice(0, 500) })
    throw new Error(`Failed to fetch invoices: ${error}`)
  }

  const data = await response.json()
  const invoices = data.QueryResponse?.Invoice || []
  logQuickBooksClient("fetch invoices parsed", { count: invoices.length })
  return invoices
}

export async function fetchInvoice(
  accessToken: string,
  realmId: string,
  invoiceId: string
): Promise<QuickBooksInvoice | null> {
  const url = `${QUICKBOOKS_BASE_URL}/v3/company/${realmId}/invoice/${invoiceId}`

  logQuickBooksClient("fetch invoice request", {
    realmId,
    invoiceId,
    hasAccessToken: Boolean(accessToken),
  })

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  })

  logQuickBooksClient("fetch invoice response", { status: response.status, ok: response.ok })

  if (!response.ok) {
    if (response.status === 404) {
      return null
    }
    const error = sanitizeQuickBooksLog(await response.text())
    logQuickBooksClient("fetch invoice error body", { error: error.slice(0, 500) })
    throw new Error(`Failed to fetch invoice: ${error}`)
  }

  const data = await response.json()
  return data.Invoice || null
}

export function createInvoiceCommitmentData(invoice: QuickBooksInvoice): string {
  return JSON.stringify({
    id: invoice.Id,
    docNumber: invoice.DocNumber,
    customer: invoice.CustomerRef.name,
    amount: invoice.TotalAmt,
    dueDate: invoice.DueDate,
    txnDate: invoice.TxnDate,
  })
}

export function formatInvoiceForDisplay(invoice: QuickBooksInvoice) {
  return {
    id: invoice.Id,
    docNumber: invoice.DocNumber,
    customerName: invoice.CustomerRef.name,
    customerId: invoice.CustomerRef.value,
    amount: invoice.TotalAmt,
    balance: invoice.Balance,
    dueDate: invoice.DueDate,
    txnDate: invoice.TxnDate,
    isPaid: invoice.Balance === 0,
    email: invoice.BillEmail?.Address,
    lineItems: invoice.Line.filter((line) => line.DetailType === "SalesItemLineDetail").map((line) => ({
      description: line.Description,
      amount: line.Amount,
      quantity: line.SalesItemLineDetail?.Qty,
      unitPrice: line.SalesItemLineDetail?.UnitPrice,
    })),
  }
}

const tokenStore = new Map<string, QuickBooksTokens>()

export function storeTokens(userId: string, tokens: QuickBooksTokens) {
  tokenStore.set(userId, tokens)
}

export function getStoredTokens(userId: string): QuickBooksTokens | undefined {
  return tokenStore.get(userId)
}

export function clearTokens(userId: string) {
  tokenStore.delete(userId)
}