export function routeTask(task: string) {
  const normalizedTask = task.toLowerCase();

  if (normalizedTask.includes("email")) {
    return "emailAutomation";
  }

  if (normalizedTask.includes("report")) {
    return "aiReportGenerator";
  }

  if (normalizedTask.includes("crm")) {
    return "crmUpdater";
  }

  return "human_assist";
}
