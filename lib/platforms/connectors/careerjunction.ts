import { parseRSS } from "@/lib/platforms/parser/rssParser";

export async function fetchCareerJunctionJobs() {
  const res = await fetch("https://www.careerjunction.co.za/rss", { cache: "no-store" });

  if (!res.ok) {
    return [];
  }

  const xml = await res.text();
  return parseRSS(xml, "careerjunction");
}