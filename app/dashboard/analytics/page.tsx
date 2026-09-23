export const dynamic = "force-dynamic";

async function getAnalyticsData() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/analytics/kpi`, {
    cache: "no-store",
  });

  if (!res.ok) {
    return null;
  }

  return res.json() as Promise<{
    visits: number;
    leads: number;
    bookedCalls: number;
    conversions: number;
    conversionRate: number;
    revenue: number;
    revenueToday: number;
    revenueMonth: number;
    revenueByStream: Record<string, number>;
  }>;
}

export default async function DashboardAnalyticsPage() {
  const data = await getAnalyticsData();

  return (
    <main className="p-6">
      <h1 className="mb-4 text-3xl font-bold">Performance</h1>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <p>Visits: {data?.visits ?? 0}</p>
        <p>Leads: {data?.leads ?? 0}</p>
        <p>Booked Calls: {data?.bookedCalls ?? 0}</p>
        <p>Conversions: {data?.conversions ?? 0}</p>
        <p>Conversion Rate: {data?.conversionRate ?? 0}%</p>
        <p>Revenue Today: R{data?.revenueToday ?? 0}</p>
        <p>Revenue This Month: R{data?.revenueMonth ?? 0}</p>
        <p>Revenue Total: R{data?.revenue ?? 0}</p>
      </div>

      <section className="mt-6">
        <h2 className="mb-2 text-xl font-semibold">Revenue by Stream</h2>
        <div className="grid gap-2">
          {Object.entries(data?.revenueByStream || {}).map(([stream, amount]) => (
            <p key={stream}>{stream}: R{amount}</p>
          ))}
        </div>
      </section>
    </main>
  );
}