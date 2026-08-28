import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

function isAuthenticated(req: NextRequest): boolean {
  return Boolean(req.cookies.get("session")?.value)
}

export function middleware(req: NextRequest) {
  if (isAuthenticated(req)) {
    return NextResponse.next()
  }

  const signInUrl = new URL("/signin", req.url)
  signInUrl.searchParams.set("next", req.nextUrl.pathname)
  return NextResponse.redirect(signInUrl)
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/governance-control-room/:path*"],
}
