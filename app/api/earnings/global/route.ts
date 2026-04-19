import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildTransparentEarningsSummary } from "@/lib/earnings/tracker";

type EarningsRow = {
  amount: number | null;
  currency?: string | null;
  ai_assisted?: boolean | null;
  platform?: string | null;
  status?: string | null;
};

const supabase = createClient(
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const usdToLocalRates = {
  USD: 1,
  GBP: 0.79,
  AED: 3.67,
} as const;

function toUsdEquivalent(amount: number, currency: string) {
  if (currency === "GBP") {
    return amount / usdToLocalRates.GBP;
  }

  if (currency === "AED") {
    return amount / usdToLocalRates.AED;
  }

  return amount;
}

function aggregateRows(rows: EarningsRow[]) {
  let usd = 0;
  let gbp = 0;
  let aed = 0;
  const byPlatform: Record<string, number> = {};

  const normalizedRows = rows.map((row) => {
    const amount = Number(row.amount || 0);
    const currency = String(row.currency || "USD").toUpperCase();
    const platform = String(row.platform || "Unassigned");

    if (currency === "GBP") {
      gbp += amount;
    } else if (currency === "AED") {
      aed += amount;
    } else {
      usd += amount;
    }

    byPlatform[platform] = (byPlatform[platform] || 0) + amount;

    return {
      amount: toUsdEquivalent(amount, currency),
      ai_assisted: row.ai_assisted ?? true,
      status: row.status,
    };
  });

  const transparency = buildTransparentEarningsSummary(normalizedRows);
  const pending = rows
    .filter((row) => String(row.status || "").toLowerCase() === "pending")
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const withdrawn = rows
    .filter((row) => ["paid", "withdrawn"].includes(String(row.status || "").toLowerCase()))
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);

  return {
    usd: Math.round(usd),
    gbp: Math.round(gbp),
    aed: Math.round(aed),
    total_usd_equivalent: Math.round(transparency.total_earned),
    ...transparency,
    your_cut: transparency.platform_cut,
    pending: Math.round(pending * 100) / 100,
    withdrawn: Math.round(withdrawn * 100) / 100,
    by_platform: byPlatform,
  };
}

async function loadEarningsRows(): Promise<EarningsRow[]> {
  const withAiAssisted = await supabase
    .from("earnings")
    .select("amount, currency, ai_assisted, platform, status");

  if (!withAiAssisted.error) {
    return (withAiAssisted.data || []) as EarningsRow[];
  }

  const errorMessage = String(withAiAssisted.error.message || "").toLowerCase();

  if (
    errorMessage.includes("ai_assisted") ||
    errorMessage.includes("currency") ||
    errorMessage.includes("platform") ||
    errorMessage.includes("status")
  ) {
    const fallbackWithCurrency = await supabase
      .from("earnings")
      .select("amount, currency, platform, status");

    if (!fallbackWithCurrency.error) {
      return ((fallbackWithCurrency.data || []) as Array<{ amount: number | null; currency?: string | null }>).map((row) => ({
        ...row,
        ai_assisted: true,
      }));
    }

    const legacyFallback = await supabase
      .from("earnings")
      .select("amount");

    if (!legacyFallback.error) {
      return ((legacyFallback.data || []) as Array<{ amount: number | null }>).map((row) => ({
        ...row,
        currency: "USD",
        ai_assisted: true,
        platform: "Unassigned",
        status: "recorded",
      }));
    }
  }

  return [];
}

export async function GET() {
  const earningsRows = await loadEarningsRows();

  if (earningsRows.length > 0) {
    return NextResponse.json(aggregateRows(earningsRows));
  }

  const { data, error } = await supabase
    .from("active_jobs")
    .select("*");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const fallbackRows = (data || []).map((job) => ({
    amount: Number(job.pay_amount || 0),
    currency: String(job.currency || job.pay_currency || "USD").toUpperCase(),
    ai_assisted: true,
  }));

  return NextResponse.json(aggregateRows(fallbackRows));
}
