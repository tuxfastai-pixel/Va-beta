export function fillTenderDoc(template: string, company: { name?: string; director?: string; email?: string }) {
  return template
    .replace("{{company_name}}", String(company.name || ""))
    .replace("{{director}}", String(company.director || ""))
    .replace("{{email}}", String(company.email || ""));
}