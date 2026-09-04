import { parseRSS } from "@/lib/platforms/parser/rssParser";

export async function fetchIndeedJobs(query = "admin remote") {
  const url = `https://rss.indeed.com/rss?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    return [];
  }

  const xml = await res.text();
  return parseRSS(xml, "indeed");
}