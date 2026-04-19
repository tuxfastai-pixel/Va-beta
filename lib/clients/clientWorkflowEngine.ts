import { detectIntent } from "../taskOrchestrator";

type ServicePackage =
  | "Admin Support"
  | "CRM Management"
  | "Marketing"
  | "Data Operations";

type WorkflowTask = {
  task: string;
  intent: string;
  status: "queued" | "executed";
};

type ClientWorkflow = {
  clientName: string;
  services: ServicePackage[];
  tasks: WorkflowTask[];
};

const serviceTaskMap: Record<ServicePackage, string[]> = {
  "Admin Support": ["emails", "scheduling"],
  "CRM Management": ["lead updates"],
  Marketing: ["social posts"],
  "Data Operations": ["reporting"],
};

export function createClientWorkflow(clientName: string, services: ServicePackage[]): ClientWorkflow {
  const uniqueTasks = new Set<string>();

  for (const service of services) {
    for (const task of serviceTaskMap[service]) {
      uniqueTasks.add(task);
    }
  }

  const tasks: WorkflowTask[] = Array.from(uniqueTasks).map((task) => ({
    task,
    intent: detectIntent(task),
    status: "queued",
  }));

  return {
    clientName,
    services,
    tasks,
  };
}

export function executeClientWorkflow(workflow: ClientWorkflow) {
  return workflow.tasks.map((task) => ({
    ...task,
    status: "executed" as const,
  }));
}

export function getServicePackages() {
  return serviceTaskMap;
}
