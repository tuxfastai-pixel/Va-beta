import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import jwt from "jsonwebtoken"
import { supabaseServer } from "@/lib/supabaseServer"

export type UserRole = "founder" | "admin" | "coach" | "client"

type SessionTokenPayload = jwt.JwtPayload & {
  userId?: string
}

export type AuthenticatedUser = {
  id: string
  email: string
  name: string | null
  role: UserRole
}

type AuthResult =
  | { user: AuthenticatedUser }
  | { response: NextResponse<{ error: string }> }

function normalizeRole(role: string | null | undefined): UserRole {
  const value = String(role || "client").trim().toLowerCase()
  if (value === "founder" || value === "admin" || value === "coach") {
    return value
  }
  return "client"
}

export async function getSessionUser(): Promise<AuthResult> {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    return {
      response: NextResponse.json({ error: "JWT secret not configured" }, { status: 500 }),
    }
  }

  const cookieStore = await cookies()
  const sessionToken = cookieStore.get("session")?.value
  if (!sessionToken) {
    return {
      response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
    }
  }

  let decoded: string | SessionTokenPayload
  try {
    decoded = jwt.verify(sessionToken, secret) as string | SessionTokenPayload
  } catch {
    return {
      response: NextResponse.json({ error: "Invalid session" }, { status: 401 }),
    }
  }

  const userId = typeof decoded === "string" ? null : decoded.userId
  if (!userId) {
    return {
      response: NextResponse.json({ error: "Invalid session payload" }, { status: 401 }),
    }
  }

  const { data: user, error } = await supabaseServer
    .from("client_users")
    .select("id, email, name, role")
    .eq("id", userId)
    .maybeSingle()

  if (error || !user) {
    return {
      response: NextResponse.json({ error: "User not found" }, { status: 404 }),
    }
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: normalizeRole(user.role),
    },
  }
}

export async function requireRoles(roles: UserRole[]): Promise<AuthResult> {
  const auth = await getSessionUser()
  if ("response" in auth) {
    return auth
  }

  if (!roles.includes(auth.user.role)) {
    return {
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    }
  }

  return auth
}

export async function requireAdminRole(): Promise<AuthResult> {
  return requireRoles(["founder", "admin"])
}

export async function requireFounderRole(): Promise<AuthResult> {
  return requireRoles(["founder"])
}
