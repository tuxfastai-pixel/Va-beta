export function getClientApiKey(request: Request) {
  const xApiKey = request.headers.get("x-api-key")?.trim();

  if (xApiKey) {
    return xApiKey;
  }

  const authorization = request.headers.get("authorization")?.trim();

  if (!authorization || !authorization.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return authorization.slice(7).trim();
}

export function isClientApiKeyValid(request: Request) {
  const incomingKey = getClientApiKey(request);

  if (!incomingKey) {
    return false;
  }

  const configuredKeys = [
    process.env.CLIENT_API_KEY,
    ...(process.env.CLIENT_API_KEYS || "").split(","),
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  if (configuredKeys.length === 0) {
    return false;
  }

  return configuredKeys.includes(incomingKey);
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
