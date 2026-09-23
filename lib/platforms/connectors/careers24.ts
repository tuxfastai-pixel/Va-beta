import { parseRSS } from "@/lib/platforms/parser/rssParser";

export async function fetchCareers24Jobs() {
  const res = await fetch("https://www.careers24.com/rss", { cache: "no-store" });

  if (!res.ok) {
    return [];
  }

  const xml = await res.text();
  return parseRSS(xml, "careers24");
}