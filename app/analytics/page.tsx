"use client";

import { useEffect, useState } from "react";

type AnalyticsResponse = {
  totalLeads: number;
  closedDeals: number;
  revenue: number;
  predictedRevenue?: number;
};

export default function Analytics() {
  const [data, setData] = useState<AnalyticsResponse | null>(null);

  useEffect(() => {
    Promise.all([fetch("/api/analytics"), fetch("/api/analytics/predict")])
      .then(async ([analyticsRes, predictRes]) => {
        const analytics = await analyticsRes.json();
        const predict = await predictRes.json();
        setData({
          ...analytics,
          predictedRevenue: Number(predict.predictedRevenue || 0),
        });
      })
      .catch(() => setData({ totalLeads: 0, closedDeals: 0, revenue: 0 }));
  }, []);

  if (!data) return <div style={{ padding: 20 }}>Loading...</div>;

  return (
    <div style={{ padding: 20 }}>
      <h1>Business Analytics</h1>

      <p>Total Leads: {data.totalLeads}</p>
      <p>Closed Deals: {data.closedDeals}</p>
      <p>Revenue: ${data.revenue}</p>
      <p>Predicted Revenue: ${data.predictedRevenue || 0}</p>
    </div>
  );
}
