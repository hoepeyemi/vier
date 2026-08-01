import { NextRequest, NextResponse } from "next/server"
import { exchangeCodeForTokens } from "@/lib/quickbooks"
import { isQuickBooksConfigured } from "@/lib/quickbooks-demo"
import { storeQuickBooksTokens } from "@/lib/quickbooks-session"

export const dynamic = "force-dynamic"

function logQuickBooksCallback(message: string, data?: Record<string, unknown>) {
  console.log(`[quickbooks:callback] ${message}`, data || "")
}

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const realmId = searchParams.get("realmId") || searchParams.get("realm_id")
  const state = searchParams.get("state")
  const stateCookie = request.cookies.get("quickbooks_oauth_state")?.value
  const intuitError = searchParams.get("error")
  const intuitErrorDescription = searchParams.get("error_description")

  logQuickBooksCallback("request received", {
    configured: isQuickBooksConfigured(),
    hasCode: Boolean(code),
    hasRealmId: Boolean(realmId),
    hasState: Boolean(state),
    hasStateCookie: Boolean(stateCookie),
    stateMatches: Boolean(stateCookie && state && stateCookie === state),
    intuitError,
    intuitErrorDescription,
  })

  if (!isQuickBooksConfigured()) {
    logQuickBooksCallback("not configured; redirecting to demo mode")
    return NextResponse.redirect(new URL("/dashboard/mint?quickbooks=demo", appUrl))
  }

  if (intuitError) {
    logQuickBooksCallback("Intuit returned OAuth error", { intuitError, intuitErrorDescription })
    return NextResponse.redirect(new URL("/dashboard/mint?error=quickbooks_auth_failed", appUrl))
  }

  if (!code || !realmId) {
    logQuickBooksCallback("missing callback params", { hasCode: Boolean(code), hasRealmId: Boolean(realmId) })
    return NextResponse.redirect(new URL("/dashboard/mint?error=quickbooks_auth_failed", appUrl))
  }

  if (stateCookie && state && stateCookie !== state) {
    logQuickBooksCallback("OAuth state mismatch")
    return NextResponse.redirect(new URL("/dashboard/mint?error=quickbooks_auth_failed", appUrl))
  }

  try {
    logQuickBooksCallback("exchanging authorization code", { realmId })
    const tokens = await exchangeCodeForTokens(code, realmId)
    storeQuickBooksTokens(tokens)
    logQuickBooksCallback("token exchange succeeded", {
      realmId: tokens.realmId,
      tokenType: tokens.tokenType,
      expiresIn: tokens.expiresIn,
      hasAccessToken: Boolean(tokens.accessToken),
      hasRefreshToken: Boolean(tokens.refreshToken),
    })

    const response = NextResponse.redirect(new URL("/dashboard/mint?quickbooks=success", appUrl))
    response.cookies.delete("quickbooks_oauth_state")
    return response
  } catch (error) {
    logQuickBooksCallback("token exchange failed", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.redirect(new URL("/dashboard/mint?error=quickbooks_auth_failed", appUrl))
  }
}