"use client";

import { useEffect, useState } from "react";

type LeadForm = {
  name: string;
  email: string;
  message: string;
  urgency: "urgent" | "this_week" | "flexible";
  budget: "low" | "medium" | "high";
  service: "admin" | "crm" | "va" | "mixed";
};

export default function LeadPage() {
  const [form, setForm] = useState<LeadForm>({
    name: "",
    email: "",
    message: "",
    urgency: "this_week",
    budget: "medium",
    service: "mixed",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "landing_view",
        source: document.referrer || "direct",
      }),
    });
  }, []);

  async function submit() {
    setSubmitting(true);
    try {
      await fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "form_submit",
          source: document.referrer || "direct",
        }),
      });

      await fetch("/api/inbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          source: "web",
        }),
      });

      await fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "lead_created",
          source: document.referrer || "direct",
          email: form.email,
          metadata: {
            urgency: form.urgency,
            budget: form.budget,
            service: form.service,
          },
        }),
      });

      alert("Thanks! We'll respond shortly.");
      setForm({
        name: "",
        email: "",
        message: "",
        urgency: "this_week",
        budget: "medium",
        service: "mixed",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-4 text-3xl font-bold">Get Help Fast</h1>
      <p className="mb-6 text-sm text-gray-600">Start within 24 hours. No long-term commitment. Try a small task first.</p>

      <div className="mb-6 grid gap-3 rounded border bg-gray-50 p-4 text-sm text-gray-700">
        <p className="font-medium">Drowning in emails, admin, and client messages?</p>
        <p>I help businesses stay organized, respond faster, and never miss opportunities.</p>
        <p>No full-time hire needed. Just reliable support that works.</p>
      </div>

      <div className="grid gap-3">
        <input
          className="rounded border p-3"
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          className="rounded border p-3"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <textarea
          className="rounded border p-3"
          placeholder="What do you need?"
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
        />
        <select
          className="rounded border p-3"
          value={form.urgency}
          onChange={(e) => setForm({ ...form, urgency: e.target.value as LeadForm["urgency"] })}
        >
          <option value="urgent">Urgent</option>
          <option value="this_week">This week</option>
          <option value="flexible">Flexible</option>
        </select>
        <select
          className="rounded border p-3"
          value={form.budget}
          onChange={(e) => setForm({ ...form, budget: e.target.value as LeadForm["budget"] })}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <select
          className="rounded border p-3"
          value={form.service}
          onChange={(e) => setForm({ ...form, service: e.target.value as LeadForm["service"] })}
        >
          <option value="admin">Admin</option>
          <option value="crm">CRM</option>
          <option value="va">VA</option>
          <option value="mixed">Mixed</option>
        </select>
        <button
          className="rounded bg-black px-4 py-3 text-white disabled:opacity-60"
          onClick={submit}
          disabled={submitting}
        >
          {submitting ? "Submitting..." : "Submit"}
        </button>
      </div>
    </div>
  );
}
