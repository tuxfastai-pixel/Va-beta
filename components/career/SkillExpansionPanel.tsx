type SkillExpansionPanelProps = {
  skills: string[]
  hiddenSkills: string[]
  recommendedRoles: string[]
}

export default function SkillExpansionPanel({ skills, hiddenSkills, recommendedRoles }: SkillExpansionPanelProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="text-base font-semibold text-slate-900">Capability Expansion</h3>
      <p className="mt-2 text-sm text-slate-600">Hidden transferable capabilities discovered from your intake.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {hiddenSkills.map((item) => (
          <span key={item} className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
            {item}
          </span>
        ))}
      </div>
      <p className="mt-4 text-xs uppercase tracking-[0.1em] text-slate-500">Skills</p>
      <p className="mt-1 text-sm text-slate-700">{skills.slice(0, 8).join(", ") || "No skills detected yet"}</p>
      <p className="mt-4 text-xs uppercase tracking-[0.1em] text-slate-500">Expanded role options</p>
      <p className="mt-1 text-sm text-slate-700">{recommendedRoles.slice(0, 6).join(", ") || "Pending role mapping"}</p>
    </section>
  )
}
