import { NextRequest, NextResponse } from "next/server"
import { fetchInvoices, formatInvoiceForDisplay, refreshAccessToken } from "@/lib/quickbooks"
import { getDemoQuickBooksInvoices, isQuickBooksConfigured } from "@/lib/quickbooks-demo"
import { clearQuickBooksTokens, getQuickBooksTokens, storeQuickBooksTokens } from "@/lib/quickbooks-session"

export const dynamic = "force-dynamic"

const SESSION_KEY = "default"
const VALID_STATUSES = new Set(["open", "paid", "all"])

function logQuickBooksInvoices(message: string, data?: Record<string, unknown>) {
  console.log(`[quickbooks:invoices] ${message}`, data || "")
}

function parseInvoiceQuery(request: NextRequest) {
  const statusParam = request.nextUrl.searchParams.get("status") || "all"
  const limitParam = Number.parseInt(request.nextUrl.searchParams.get("limit") || "100", 10)
  const status = VALID_STATUSES.has(statusParam) ? statusParam as "open" | "paid" | "all" : "all"
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 1000) : 100
  return { status, limit }
}

function filterDemoInvoices(status: "open" | "paid" | "all") {
  const invoices = getDemoQuickBooksInvoices()
  if (status === "open") return invoices.filter((invoice) => invoice.Balance > 0)
  if (status === "paid") return invoices.filter((invoice) => invoice.Balance === 0)
  return invoices
}

export async function GET(request: NextRequest) {
  try {
    const { status, limit } = parseInvoiceQuery(request)
    const configured = isQuickBooksConfigured()

    logQuickBooksInvoices("request received", {
      configured,
      status,
      limit,
      hasStoredTokens: Boolean(getQuickBooksTokens(SESSION_KEY)),
      environment: process.env.QUICKBOOKS_ENVIRONMENT || "sandbox",
    })

    if (!configured) {
      const invoices = filterDemoInvoices(status).slice(0, limit).map(formatInvoiceForDisplay)
      logQuickBooksInvoices("serving demo invoices", { count: invoices.length })

      return NextResponse.json({
        success: true,
        data: {
          invoices,
          total: invoices.length,
          status,
          demo: true,
        },
      })
    }

    const storedTokens = getQuickBooksTokens(SESSION_KEY)
    if (!storedTokens) {
      logQuickBooksInvoices("requires auth; no stored tokens")
      return NextResponse.json({
        success: false,
        requiresAuth: true,
        error: "QuickBooks is not connected yet.",
      })
    }

    let tokens = storedTokens
    if (tokens.expiresAt && tokens.expiresAt <= Date.now() + 60_000) {
      logQuickBooksInvoices("stored token near expiry; refreshing", {
        realmId: tokens.realmId,
        expiresAt: tokens.expiresAt,
      })
      try {
        const refreshed = await refreshAccessToken(tokens.refreshToken)
        tokens = {
          ...refreshed,
          realmId: tokens.realmId,
        }
        storeQuickBooksTokens(tokens, SESSION_KEY)
        logQuickBooksInvoices("refresh succeeded", { realmId: tokens.realmId })
      } catch (error) {
        clearQuickBooksTokens(SESSION_KEY)
        logQuickBooksInvoices("refresh failed; cleared tokens", {
          error: error instanceof Error ? error.message : String(error),
        })
        return NextResponse.json({
          success: false,
          requiresAuth: true,
          error: "QuickBooks session expired. Please reconnect.",
        })
      }
    }

    const qbInvoices = await fetchInvoices(tokens.accessToken, tokens.realmId, { status, limit })
    const invoices = qbInvoices.map(formatInvoiceForDisplay)
    logQuickBooksInvoices("returning live invoices", { count: invoices.length, realmId: tokens.realmId })

    return NextResponse.json({
      success: true,
      data: {
        invoices,
        total: invoices.length,
        status,
        demo: false,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch invoices"
    logQuickBooksInvoices("request failed", { error: message })
    return NextResponse.json(
      {
        success: false,
        requiresAuth: /401|unauthorized|token|auth/i.test(message),
        error: message,
      },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  logQuickBooksInvoices("clearing stored tokens")
  clearQuickBooksTokens(SESSION_KEY)
  return NextResponse.json({ success: true })
}