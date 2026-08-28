import { cookies } from "next/headers"
import jwt from "jsonwebtoken"

type SessionTokenPayload = jwt.JwtPayload & {
  userId?: string
  email?: string
}

export async function getSessionUser() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get("session")?.value

  if (!sessionToken) {
    return null
  }

  let decoded: string | SessionTokenPayload
  try {
    decoded = jwt.verify(sessionToken, process.env.JWT_SECRET! as string) as string | SessionTokenPayload
  } catch {
    return null
  }

  const userId = typeof decoded === "string" ? "" : String(decoded.userId || "").trim()
  const email = typeof decoded === "string" ? "" : String(decoded.email || "").trim().toLowerCase()

  if (!userId) {
    return null
  }

  return {
    userId,
    email,
  }
}
