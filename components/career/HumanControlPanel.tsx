type HumanControlPanelProps = {
  onPause: () => void
  onQuietMode: () => void
  onDisableSuggestions: () => void
}

export default function HumanControlPanel({
  onPause,
  onQuietMode,
  onDisableSuggestions,
}: HumanControlPanelProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700">Human Approval Controls</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onPause}
          className="rounded-lg border border-slate-300 bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
        >
          Pause autonomy
        </button>
        <button
          type="button"
          onClick={onQuietMode}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800"
        >
          Quiet mode
        </button>
        <button
          type="button"
          onClick={onDisableSuggestions}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800"
        >
          Disable suggestions
        </button>
      </div>
    </section>
  )
}
