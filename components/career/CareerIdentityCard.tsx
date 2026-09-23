import type { CareerIdentityProfile } from "@/lib/career/careerTypes.ts"

type CareerIdentityCardProps = {
  profile: CareerIdentityProfile | null
}

export default function CareerIdentityCard({ profile }: CareerIdentityCardProps) {
  if (!profile) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-base font-semibold text-slate-900">Career Identity</h3>
        <p className="mt-2 text-sm text-slate-600">No profile generated yet.</p>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="text-base font-semibold text-slate-900">Career Identity</h3>
      <p className="mt-2 text-sm text-slate-700">{profile.summary}</p>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs uppercase tracking-[0.1em] text-slate-500">Profile Confidence</p>
          <p className="mt-1 font-semibold text-slate-900">{Math.round(profile.profileConfidence * 100)}%</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs uppercase tracking-[0.1em] text-slate-500">International Fit</p>
          <p className="mt-1 font-semibold text-slate-900">{Math.round(profile.internationalEmployabilityScore * 100)}%</p>
        </div>
      </div>
      <p className="mt-4 text-xs text-slate-500">Top roles: {profile.recommendedRoles.slice(0, 4).join(", ") || "Pending"}</p>
    </section>
  )
}
