type AIResumeDiffViewerProps = {
  originalText: string
  reconstructedText: string
}

export default function AIResumeDiffViewer({ originalText, reconstructedText }: AIResumeDiffViewerProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="text-base font-semibold text-slate-900">AI Resume Diff</h3>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <p className="mb-2 text-xs uppercase tracking-[0.1em] text-slate-500">Original</p>
          <pre className="max-h-56 overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-700">{originalText || "No source text."}</pre>
        </div>
        <div>
          <p className="mb-2 text-xs uppercase tracking-[0.1em] text-slate-500">Reconstructed</p>
          <pre className="max-h-56 overflow-auto rounded-lg bg-emerald-50 p-3 text-xs text-emerald-900">{reconstructedText || "No reconstructed text."}</pre>
        </div>
      </div>
    </section>
  )
}
