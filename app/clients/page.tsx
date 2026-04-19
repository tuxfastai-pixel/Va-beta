import { getWorkers } from "@/lib/db/workers";
import { matchWorker } from "@/lib/agents/workerMatcher";

export default async function ClientsPage() {
  const workers = await getWorkers();

  const project = {
    title: "Virtual Assistant Support Project",
    required_skills: ["email", "calendar", "crm", "reporting"],
  };

  const workerCandidates = workers.map((worker) => ({
    worker_name: worker.worker_name,
    skills: ["email", "calendar", "crm", "reporting", "research"],
  }));

  const matches = matchWorker(project, workerCandidates).slice(0, 5);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Clients Workspace</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white shadow rounded-xl p-6 space-y-3">
          <h2 className="text-lg font-semibold">Client Delivery Flow</h2>
          <p>1. Company</p>
          <p>2. Create project</p>
          <p>3. AI Worker matched</p>
          <p>4. Proposal generated</p>
          <p>5. Contract</p>
          <p>6. Task automation</p>
        </div>

        <div className="bg-white shadow rounded-xl p-6 space-y-3">
          <h2 className="text-lg font-semibold">Project Snapshot</h2>
          <p>Project: {project.title}</p>
          <p>Required Skills: {project.required_skills.join(", ")}</p>
          <p>Status: Matching workers</p>
        </div>
      </div>

      <div className="bg-white shadow rounded-xl p-6 space-y-3">
        <h2 className="text-lg font-semibold">AI Worker Matching for Client Jobs</h2>

        {matches.length === 0 ? (
          <p>No workers found.</p>
        ) : (
          <div className="space-y-2">
            {matches.map((entry) => (
              <div key={entry.worker.worker_name} className="border rounded p-3">
                <p>Worker: {entry.worker.worker_name}</p>
                <p>Match Score: {entry.score}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
