import { parseRSS } from "@/lib/platforms/parser/rssParser";

export async function fetchPNetJobs() {
  const res = await fetch("https://www.pnet.co.za/jobs/rss", { cache: "no-store" });

  if (!res.ok) {
    return [];
  }

  const xml = await res.text();
  return parseRSS(xml, "pnet");
}