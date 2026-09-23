type WelcomeCardProps = {
  userName?: string | null
}

export default function WelcomeCard({ userName }: WelcomeCardProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Career Identity Intake</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">
        {userName ? `Welcome, ${userName}` : "Welcome to Your Career Operating System"}
      </h1>
      <p className="mt-3 text-sm leading-6 text-slate-700">
        The system helps you discover and prepare for opportunities, but you remain in control of all applications and
        important decisions.
      </p>
    </section>
  )
}
