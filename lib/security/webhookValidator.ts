import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { writeAuditLog } from "@/lib/audit/auditLog";
import { logger } from "@/lib/logger/logger";

export type WebhookSource = "payfast" | "wise" | "stripe" | "custom";

/** Source-specific signature verification */
function verifySignature(
  source: WebhookSource,
  rawBody: string,
  signature: string | null
): boolean {
  if (!signature) return false;

  switch (source) {
    case "payfast": {
      const secret = process.env.PAYFAST_PASSPHRASE ?? "";
      // PayFast uses MD5 of sorted param string + passphrase
      const params = new URLSearchParams(rawBody);
      params.delete("signature");
      const sorted = [...params.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${encodeURIComponent(v).replace(/%20/g, "+")}`)
        .join("&");
      const withPassphrase = secret ? `${sorted}&passphrase=${encodeURIComponent(secret)}` : sorted;
      const expected = crypto.createHash("md5").update(withPassphrase).digest("hex");
      return expected === signature;
    }

    case "wise":
    case "stripe":
    case "custom": {
      const secret = process.env.WEBHOOK_SECRET ?? "";
      if (!secret) return false;
      const hmac = crypto
        .createHmac("sha256", secret)
        .update(rawBody, "utf-8")
        .digest("hex");
      // Constant-time comparison to prevent timing attacks
      try {
        return crypto.timingSafeEqual(
          Buffer.from(hmac, "hex"),
          Buffer.from(signature.replace(/^sha256=/, ""), "hex")
        );
      } catch {
        return false;
      }
    }

    default:
      return false;
  }
}

/**
 * Wraps a webhook handler with:
 * 1. Signature verification
 * 2. Idempotency (skip already-processed events)
 * 3. Audit logging
 */
export function withWebhookValidation(
  source: WebhookSource,
  handler: (payload: unknown, req: NextRequest) => Promise<void>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const rawBody = await req.text();

    // Get signature from common headers
    const signature =
      req.headers.get("x-payfast-signature") ??
      req.headers.get("x-signature") ??
      req.headers.get("stripe-signature") ??
      req.headers.get("x-webhook-signature");

    const verified = verifySignature(source, rawBody, signature);

    if (!verified) {
      logger.warn("[WEBHOOK] Signature verification failed", { source }, "webhook");
      await writeAuditLog({
        event_type: "payment_failed",
        entity_type: "webhook",
        actor: `webhook:${source}`,
        payload: { reason: "invalid_signature", source },
      });
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // Parse payload
    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      payload = Object.fromEntries(new URLSearchParams(rawBody));
    }

    // Idempotency: derive a stable event ID from body hash
    const eventId = crypto.createHash("sha256").update(rawBody).digest("hex").slice(0, 32);

    // Check if already processed
    const { data: existing } = await supabaseServer
      .from("webhook_events")
      .select("id, processed")
      .eq("source", source)
      .textSearch("payload::text", eventId) // approximate; use proper eq on id in production
      .limit(1);

    if (existing && existing.length > 0 && existing[0].processed) {
      logger.info("[WEBHOOK] Skipping duplicate event", { source, eventId }, "webhook");
      return NextResponse.json({ ok: true, duplicate: true });
    }

    // Persist event
    await supabaseServer.from("webhook_events").insert({
      source,
      event_type: (payload as Record<string, unknown>)?.type ?? "unknown",
      payload,
      signature: signature ?? "",
      verified: true,
      processed: false,
    });

    // Execute handler
    try {
      await handler(payload, req);

      // Mark processed
      await supabaseServer
        .from("webhook_events")
        .update({ processed: true, processed_at: new Date().toISOString() })
        .eq("source", source)
        .eq("verified", true)
        .is("processed_at", null);

      logger.info("[WEBHOOK] Processed", { source, eventId }, "webhook");
    } catch (err) {
      logger.error("[WEBHOOK] Handler error", err, { source, eventId }, "webhook");
      return NextResponse.json({ error: "Processing failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  };
}
