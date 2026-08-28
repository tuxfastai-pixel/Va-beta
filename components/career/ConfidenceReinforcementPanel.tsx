type ConfidenceReinforcementPanelProps = {
  confidence: number
  notes: string[]
}

export default function ConfidenceReinforcementPanel({ confidence, notes }: ConfidenceReinforcementPanelProps) {
  const score = Math.round(Math.max(0, Math.min(1, confidence)) * 100)

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="text-base font-semibold text-slate-900">Confidence Reinforcement</h3>
      <p className="mt-2 text-sm text-slate-700">Current confidence trajectory: {score}%</p>
      <ul className="mt-3 space-y-2 text-sm text-slate-600">
        {notes.map((note, index) => (
          <li key={`${note}-${index}`} className="flex items-start gap-2">
            <span aria-hidden className="mt-0.5 text-slate-400">•</span>
            <span>{note}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
