export default function TrustTransparencyPanel() {
  const points = [
    "AI suggestions are explainable and reversible",
    "No autonomous application submissions",
    "Trust regulation and pacing controls stay active",
    "Every major action can be paused or routed for review",
  ]

  return (
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
      <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-emerald-800">Trust Transparency</h2>
      <ul className="mt-3 space-y-2 text-sm text-emerald-900">
        {points.map((point) => (
          <li key={point} className="flex items-start gap-2">
            <span aria-hidden className="mt-0.5 text-emerald-700">•</span>
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
