export const CAREERS = [
  "teacher",
  "admin",
  "writer",
  "customer_support",
  "data_entry",
] as const;

export type Career = (typeof CAREERS)[number];

export function normalizeCareer(value: string): Career | null {
  const normalized = value.trim().toLowerCase();
  return CAREERS.includes(normalized as Career) ? (normalized as Career) : null;
}

export function formatCareerLabel(career: string): string {
  return career
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
