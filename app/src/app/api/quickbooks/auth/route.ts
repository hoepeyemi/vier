import { NextRequest, NextResponse } from "next/server"
import { getAuthorizationUrl } from "@/lib/quickbooks"
import { isQuickBooksConfigured } from "@/lib/quickbooks-demo"

export const dynamic = "force-dynamic"

function logQuickBooksAuth(message: string, data?: Record<string, unknown>) {
  console.log(`[quickbooks:auth] ${message}`, data || "")
}

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin

  logQuickBooksAuth("request received", {
    appUrl,
    configured: isQuickBooksConfigured(),
    hasClientId: Boolean(process.env.QUICKBOOKS_CLIENT_ID),
    hasClientSecret: Boolean(process.env.QUICKBOOKS_CLIENT_SECRET),
    redirectUri: process.env.QUICKBOOKS_REDIRECT_URI || null,
    environment: process.env.QUICKBOOKS_ENVIRONMENT || "sandbox",
  })

  if (!isQuickBooksConfigured()) {
    logQuickBooksAuth("not configured; redirecting to demo mode")
    return NextResponse.redirect(new URL("/dashboard/mint?quickbooks=demo", appUrl))
  }

  try {
    const state = crypto.randomUUID()
    const authUrl = getAuthorizationUrl(state)
    const parsedAuthUrl = new URL(authUrl)

    logQuickBooksAuth("redirecting to Intuit OAuth", {
      host: parsedAuthUrl.host,
      pathname: parsedAuthUrl.pathname,
      hasState: Boolean(state),
      scope: parsedAuthUrl.searchParams.get("scope"),
      redirectUri: parsedAuthUrl.searchParams.get("redirect_uri"),
    })

    const response = NextResponse.redirect(authUrl)
    response.cookies.set("quickbooks_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 10 * 60,
    })
    return response
  } catch (error) {
    logQuickBooksAuth("failed before OAuth redirect", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.redirect(new URL("/dashboard/mint?error=quickbooks_auth_failed", appUrl))
  }
}