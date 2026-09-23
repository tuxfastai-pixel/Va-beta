export default function Landing() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-3xl font-bold">
        Get reliable admin and virtual support starting today
      </h1>
      <p className="mt-2 text-lg">
        I handle admin, client follow-ups, and operations so you can focus on growth.
      </p>

      <a href="/lead" className="mt-4 inline-block rounded bg-black px-4 py-2 text-white">
        Get Started
      </a>

      <section className="mt-8">
        <h2 className="font-semibold">What I handle</h2>
        <ul className="ml-5 list-disc">
          <li>Email and calendar management</li>
          <li>Client follow-ups and CRM updates</li>
          <li>Data entry, spreadsheets, reporting</li>
          <li>Basic bookkeeping and invoicing</li>
        </ul>
      </section>

      <section className="mt-8">
        <p>Fast turnaround. Clear communication. Scalable support.</p>
      </section>

      <a href="/lead" className="mt-6 inline-block rounded border px-4 py-2">
        Tell me what you need
      </a>
    </main>
  );
}
