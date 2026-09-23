import { NextResponse } from "next/server";
import { signContract } from "@/lib/contracts/generator";

/**
 * POST /api/contracts/sign
 * Sign contract with name, timestamp, and IP logging
 */
export async function POST(req: Request) {
  try {
    const { contractId, name } = await req.json();

    if (!contractId || !name) {
      return NextResponse.json(
        { error: "contractId and name are required" },
        { status: 400 }
      );
    }

    // Get client IP
    const ip =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      "unknown";

    // Sign the contract
    const contract = await signContract(contractId, name, ip);

    if (!contract) {
      return NextResponse.json(
        { error: "Failed to sign contract" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      contract,
      message: "Contract signed successfully",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[contracts/sign] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
