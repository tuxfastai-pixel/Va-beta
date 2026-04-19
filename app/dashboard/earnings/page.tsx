"use client";

import { useEffect, useState } from "react";

type EarningsData = {
  usd: number;
  gbp: number;
  aed: number;
  total_usd_equivalent: number;
  total_earned: number;
  ai_generated: number;
  user_generated: number;
  platform_cut: number;
  your_cut: number;
  pending: number;
  withdrawn: number;
  user_receives: number;
  by_platform: Record<string, number>;
};

export default function EarningsDashboard() {
  const [earnings, setEarnings] = useState<EarningsData | null>(null);
  const [totalEarnings, setTotalEarnings] = useState(0);

  useEffect(() => {
    fetch("/api/earnings/global")
      .then((res) => res.json())
      .then((data) => setEarnings(data));

    fetch("/api/earnings")
      .then((res) => res.json())
      .then((data) => setTotalEarnings(Number(data?.total || 0)));
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Projected Monthly Earnings</h1>

      <p>USD: ${earnings?.usd ?? 0}</p>
      <p>GBP: £{earnings?.gbp ?? 0}</p>
      <p>AED: {earnings?.aed ?? 0} AED</p>

      <p className="mt-4 font-semibold">
        Total (USD equivalent): ${earnings?.total_usd_equivalent ?? 0}
      </p>

      <div className="mt-4 space-y-1">
        <p>Total Earned: ${earnings?.total_earned ?? 0}</p>
        <p>AI-generated: ${earnings?.ai_generated ?? 0}</p>
        <p>User-generated: ${earnings?.user_generated ?? 0}</p>
        <p>Your Cut: ${earnings?.your_cut ?? 0}</p>
        <p>Pending: ${earnings?.pending ?? 0}</p>
        <p>Withdrawn: ${earnings?.withdrawn ?? 0}</p>
        <p>Platform Cut: ${earnings?.platform_cut ?? 0}</p>
        <p className="font-semibold text-green-700">User Receives: ${earnings?.user_receives ?? 0}</p>
      </div>

      {earnings && Object.keys(earnings.by_platform || {}).length > 0 && (
        <div className="mt-4 space-y-1">
          <h2 className="font-semibold">Per-platform breakdown</h2>
          {Object.entries(earnings.by_platform).map(([platform, amount]) => (
            <p key={platform}>{platform}: ${Number(amount).toFixed(2)}</p>
          ))}
        </div>
      )}

      <p className="mt-2 text-sm text-gray-600">This work was completed using advanced tools to ensure speed and accuracy.</p>
      <p className="mt-2 font-semibold">Total Earnings: ${totalEarnings}</p>
    </div>
  );
}
