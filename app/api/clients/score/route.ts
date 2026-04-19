import { NextRequest, NextResponse } from "next/server";
import { updateClientScore, rescoreAllClients } from "@/lib/clients/clientScoring";
import { isUuid } from "@/lib/clients/clientApiAuth";

// GET /api/clients/score?clientId=<uuid>
export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get("clientId");

  if (!clientId || !isUuid(clientId)) {
    return NextResponse.json({ error: "Valid clientId is required" }, { status: 400 });
  }

  const result = await updateClientScore(clientId);
  if (!result) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  return NextResponse.json(result);
}

// POST /api/clients/score  { clientId: uuid } — rescore a single client
//                          { userId: uuid }   — rescore all clients for a user
export async function POST(req: NextRequest) {
  let body: { clientId?: string; userId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.clientId) {
    if (!isUuid(body.clientId)) {
      return NextResponse.json({ error: "Invalid clientId" }, { status: 400 });
    }
    const result = await updateClientScore(body.clientId);
    if (!result) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, ...result });
  }

  if (body.userId) {
    if (!isUuid(body.userId)) {
      return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
    }
    await rescoreAllClients(body.userId);
    return NextResponse.json({ success: true, message: "All clients rescored" });
  }

  return NextResponse.json({ error: "clientId or userId required" }, { status: 400 });
}
