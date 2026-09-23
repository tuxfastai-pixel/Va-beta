export default function Portfolio() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-3xl font-bold">How I Work</h1>

      <section className="mb-5 rounded border p-4">
        <h2 className="mb-2 text-xl font-semibold">Workflow</h2>
        <p>Tasks to organized to tracked to completed to reported.</p>
      </section>

      <section className="mb-5 rounded border p-4">
        <h2 className="mb-2 text-xl font-semibold">Example CRM</h2>
        <p>Leads tracked, follow-ups scheduled, and no missed opportunities.</p>
      </section>

      <section className="mb-6 rounded border p-4">
        <h2 className="mb-2 text-xl font-semibold">Communication</h2>
        <p>Clear, consistent, and fast responses to clients.</p>
      </section>

      <a
        href="/portfolio.pdf"
        download
        className="inline-flex rounded bg-black px-4 py-2 text-white"
      >
        Download Overview
      </a>
    </main>
  );
}
