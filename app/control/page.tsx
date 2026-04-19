"use client";

import { useEffect, useState } from "react";

type LeadRow = {
  id: string;
  name: string | null;
  company: string | null;
  status: string | null;
};

type LeadsResponse = {
  leads?: LeadRow[];
};

export default function ControlPanel() {
  const [leads, setLeads] = useState<LeadRow[]>([]);

  const runAgent = async (endpoint: string) => {
    const res = await fetch(endpoint, { method: "POST" });
    const data = await res.json();
    alert(JSON.stringify(data, null, 2));
  };

  const loadLeads = async () => {
    const res = await fetch("/api/leads");
    const data = (await res.json()) as LeadsResponse;
    setLeads(Array.isArray(data.leads) ? data.leads : []);
  };

  const convertLead = async (leadId: string) => {
    const res = await fetch("/api/crm/convert", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ leadId }),
    });

    const data = (await res.json()) as { dealId?: string };
    alert(`Converted to deal: ${data.dealId || "N/A"}`);
    await loadLeads();
  };

  useEffect(() => {
    let isActive = true;

    const loadInitialLeads = async () => {
      const res = await fetch("/api/leads");
      const data = (await res.json()) as LeadsResponse;

      if (isActive) {
        setLeads(Array.isArray(data.leads) ? data.leads : []);
      }
    };

    void loadInitialLeads();

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>AI Control Panel</h1>

      <button onClick={() => runAgent("/api/agent/scraper/run")}>Run Lead Scraper</button>

      <br /><br />

      <button onClick={() => runAgent("/api/agent/linkedin/run")}>Run LinkedIn Agent</button>

      <br /><br />

      <button onClick={() => runAgent("/api/agent/negotiation/run")}>Run Auto-Closing</button>

      <hr style={{ margin: "24px 0" }} />

      <h2>Leads</h2>
      {leads.length === 0 ? (
        <p>No leads available.</p>
      ) : (
        leads.map((lead) => (
          <div
            key={lead.id}
            style={{
              border: "1px solid #ddd",
              borderRadius: 8,
              padding: 12,
              marginBottom: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div>
              <p style={{ margin: 0, fontWeight: 600 }}>{lead.name || "Unnamed lead"}</p>
              <p style={{ margin: "4px 0 0 0", color: "#555" }}>
                {lead.company || "No company"} · {lead.status || "new"}
              </p>
            </div>

            <button onClick={() => convertLead(lead.id)}>Convert to Deal</button>
          </div>
        ))
      )}
    </div>
  );
}
