type Worker = {
  worker_name: string;
  skills?: string[];
};

type Project = {
  title?: string;
  required_skills?: string[];
};

function skillMatch(worker: Worker, project: Project) {
  const workerSkills = (worker.skills || []).map((s) => s.toLowerCase());
  const requiredSkills = (project.required_skills || []).map((s) => s.toLowerCase());

  if (!requiredSkills.length) {
    return 0;
  }

  const matched = requiredSkills.filter((skill) => workerSkills.includes(skill)).length;
  return Math.round((matched / requiredSkills.length) * 100);
}

export function matchWorker(project: Project, workers: Worker[]) {
  return workers
    .map((worker) => ({
      worker,
      score: skillMatch(worker, project),
    }))
    .sort((a, b) => b.score - a.score);
}
