import { supabaseServer } from "@/lib/supabaseServer";
import styles from "./page.module.css";

type DashboardData = {
  total: number;
  pending: number;
  leads: number;
  replies: number;
  closed: number;
  referrals: number;
};

function toAmount(value: unknown): number {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
}

async function getCount(table: string, filter?: { column: string; value: string }): Promise<number> {
  let query = supabaseServer.from(table).select("id", { count: "exact", head: true });
  if (filter) {
    query = query.eq(filter.column, filter.value);
  }

  const { count } = await query;
  return count || 0;
}

async function getDashboardData(): Promise<DashboardData> {
  let earningsRows: Array<{ amount: number | string | null; status: string | null }> = [];
  let pendingRows: Array<{ id: string }> = [];

  try {
    const { data } = await supabaseServer.from("earnings").select("amount, status");
    earningsRows = (data || []) as Array<{ amount: number | string | null; status: string | null }>;
  } catch {
    earningsRows = [];
  }

  try {
    const { data } = await supabaseServer.from("payments").select("id").eq("status", "pending");
    pendingRows = (data || []) as Array<{ id: string }>;
  } catch {
    pendingRows = [];
  }

  const total = (earningsRows || [])
    .filter((row) => String(row.status || "").toLowerCase() !== "pending")
    .reduce((sum, row) => sum + toAmount(row.amount), 0);

  let leads = 0;
  let replied = 0;
  let negotiating = 0;
  let closed = 0;
  let referralCount = 0;

  try {
    [leads, replied, negotiating, closed] = await Promise.all([
      getCount("leads"),
      getCount("deals", { column: "stage", value: "replied" }),
      getCount("deals", { column: "stage", value: "negotiating" }),
      getCount("deals", { column: "stage", value: "closed" }),
    ]);
  } catch {
    leads = 0;
    replied = 0;
    negotiating = 0;
    closed = 0;
  }

  try {
    const res = await supabaseServer
      .from("users")
      .select("id", { count: "exact", head: true })
      .not("referred_by", "is", null);
    referralCount = res.count || 0;
  } catch {
    referralCount = 0;
  }

  return {
    total,
    pending: (pendingRows || []).length,
    leads,
    replies: replied + negotiating + closed,
    closed,
    referrals: referralCount,
  };
}

function percent(part: number, whole: number): string {
  if (!whole) return "0%";
  return `${Math.round((part / whole) * 100)}%`;
}

export default async function GrowthDashboardPage() {
  const data = await getDashboardData();

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <h1>Conversion Dashboard</h1>
        <p>Track revenue, pending payments, and funnel performance in one operating panel.</p>
      </section>

      <section className={styles.metricsGrid}>
        <article>
          <h2>Total Earned</h2>
          <p className={styles.metric}>${data.total.toFixed(2)}</p>
        </article>
        <article>
          <h2>Pending Payments</h2>
          <p className={styles.metric}>{data.pending}</p>
        </article>
        <article>
          <h2>Referrals Captured</h2>
          <p className={styles.metric}>{data.referrals}</p>
        </article>
      </section>

      <section className={styles.funnel}>
        <h2>Conversion Funnel</h2>
        <ul>
          <li>
            <span>Leads</span>
            <strong>{data.leads}</strong>
          </li>
          <li>
            <span>Replies</span>
            <strong>{data.replies}</strong>
          </li>
          <li>
            <span>Closed</span>
            <strong>{data.closed}</strong>
          </li>
        </ul>

        <div className={styles.rates}>
          <p>Lead to Reply: {percent(data.replies, data.leads)}</p>
          <p>Reply to Close: {percent(data.closed, data.replies)}</p>
        </div>
      </section>

      <section className={styles.actions}>
        <h2>Viral Growth Loop</h2>
        <p>User earns, shares success, brings a friend, and compounds the earning network.</p>
        <div className={styles.actionButtons}>
          <a href="/onboarding">Launch Onboarding Wizard</a>
          <a href="/api/payments/diagnostics">Open Payment Diagnostics</a>
        </div>
      </section>
    </main>
  );
}
