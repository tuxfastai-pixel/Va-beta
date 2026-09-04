const baseSkills: Record<string, string[]> = {
  teacher: ["Lesson delivery", "Online tools", "Student engagement"],
  admin: ["Data entry", "Email handling", "Scheduling"],
  writer: ["Research", "Drafting", "Editing"],
  customer_support: ["Ticket handling", "Issue triage", "Client communication"],
  data_entry: ["Spreadsheet accuracy", "Validation", "Data hygiene"],
};

export function generateMultiSkillPath(careers: string[]) {
  return careers.reduce<Record<string, string[]>>((acc, career) => {
    acc[career] = baseSkills[career] || ["Basic communication", "Task execution"];
    return acc;
  }, {});
}
