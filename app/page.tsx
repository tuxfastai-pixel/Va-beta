import styles from "./page.module.css";

const wizardSteps = [
  {
    title: "Step 1: Account",
    body: "Sign up once. Your email becomes your master identity across every earning channel.",
  },
  {
    title: "Step 2: Platform Setup",
    body: "Guided setup for PayPal, LinkedIn, Upwork, and Fiverr with actionable checklists.",
  },
  {
    title: "Step 3: Skill Track",
    body: "Choose Teaching, Project Management, Admin CRM, or Finance Compliance.",
  },
  {
    title: "Step 4: AI Activation",
    body: "AI starts training, profile building, job applications, proposal writing, and closing.",
  },
];

export default function LandingPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <p className={styles.kicker}>Career Activation Wizard</p>
        <h1>Turn Your Skills Into Global Income — Powered by AI</h1>
        <p className={styles.subtitle}>
          Your AI worker finds jobs, applies, closes clients, and keeps payment follow-ups running while you focus on
          delivery.
        </p>
        <div className={styles.ctaRow}>
          <a className={styles.primaryCta} href="/onboarding">
            Start Earning Now
          </a>
          <a className={styles.secondaryCta} href="/growth">
            View Conversion Dashboard
          </a>
        </div>
      </section>

      <section className={styles.proofGrid}>
        <article>
          <h3>Real Income Simulation</h3>
          <p>Users can simulate and track over $1K monthly path before going live.</p>
        </article>
        <article>
          <h3>AI Does The Work</h3>
          <p>From outreach to proposal writing to follow-up enforcement, automation runs end to end.</p>
        </article>
      </section>

      <section className={styles.workflow}>
        <h2>How It Works</h2>
        <ol>
          <li>Create profile</li>
          <li>AI finds jobs</li>
          <li>AI applies and closes</li>
          <li>You get paid</li>
        </ol>
      </section>

      <section className={styles.wizard}>
        <h2>Career Activation Wizard</h2>
        <div className={styles.wizardGrid}>
          {wizardSteps.map((step) => (
            <article key={step.title}>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.socialProof}>
        <h2>Who Is Winning</h2>
        <div>
          <p>Teachers earning online with automated client acquisition.</p>
          <p>Admins working globally through AI-managed proposal flow.</p>
        </div>
      </section>

      <section className={styles.builder}>
        <h2>Automated Profile Builder</h2>
        <ul>
          <li>Generate LinkedIn bio</li>
          <li>Generate Upwork profile</li>
          <li>Generate Fiverr gigs</li>
          <li>Generate CV</li>
        </ul>
      </section>

      <section className={styles.finalCta}>
        <h2>Activate Your AI Worker</h2>
        <p>Launch the wizard, connect platforms, and start your earning loop.</p>
        <a className={styles.primaryCta} href="/onboarding">
          Activate Your AI Worker
        </a>
      </section>
    </main>
  );
}
