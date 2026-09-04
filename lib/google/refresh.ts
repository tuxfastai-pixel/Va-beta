export async function refreshGoogleToken(user: {
  google_refresh_token?: string | null;
}): Promise<{ access_token: string; expires_in?: number } | null> {
  if (!user.google_refresh_token) return null;

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    refresh_token: user.google_refresh_token,
    grant_type: "refresh_token",
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Token refresh failed (${response.status}): ${body}`);
  }

  const data = await response.json();
  if (!data.access_token) throw new Error("No access_token in refresh response");
  return { access_token: data.access_token, expires_in: data.expires_in };
}
