export type EngineerType =
  | "frontend"
  | "backend"
  | "database"
  | "devops";

export function classifyTask(goal: string): EngineerType {
  const g = goal.toLowerCase();

  if (g.includes("ui") || g.includes("component") || g.includes("page")) {
    return "frontend";
  }

  if (g.includes("api") || g.includes("endpoint") || g.includes("server")) {
    return "backend";
  }

  if (g.includes("database") || g.includes("schema") || g.includes("query")) {
    return "database";
  }

  if (g.includes("deploy") || g.includes("build") || g.includes("ci")) {
    return "devops";
  }

  return "backend"; // safe default
}
