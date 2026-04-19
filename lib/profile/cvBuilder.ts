type Profile = {
  name?: string | null;
};

type JobLike = {
  title?: string | null;
};

export function generateCV(profile: Profile, jobs: JobLike[]) {
  return `
Name: ${profile.name ?? "N/A"}

Skills:
${jobs.map((j) => j.title || "Untitled role").join("\n")}

Experience:
Completed AI-assisted projects with real clients.
`;
}

export function generateWorkPlan(job: JobLike) {
  const taskName = job.title || "task";

  return [
    `Step 1: Analyze requirement for ${taskName}`,
    "Step 2: Implement core logic",
    "Step 3: Test and deliver",
  ];
}
