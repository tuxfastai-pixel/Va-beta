type DataPrivacyControlsProps = {
  onExport: () => void
  onDelete: () => void
}

export default function DataPrivacyControls({ onExport, onDelete }: DataPrivacyControlsProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700">Data Privacy Controls</h2>
      <p className="mt-2 text-sm text-slate-600">Export or remove your profile data at any time.</p>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onExport}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800"
        >
          Export profile
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700"
        >
          Delete profile
        </button>
      </div>
    </section>
  )
}
