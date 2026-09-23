import { parseRSS } from "@/lib/platforms/parser/rssParser";
import { parseTender, scoreTender } from "@/lib/gov/tenderParser";

const DEFAULT_TENDER_FEEDS = [
  process.env.ETENDERS_FEED_URL,
  process.env.CSD_TENDER_FEED_URL,
].filter((value): value is string => typeof value === "string" && value.trim().length > 0);

export async function fetchTenders() {
  if (DEFAULT_TENDER_FEEDS.length === 0) {
    return [];
  }

  const feeds = await Promise.all(
    DEFAULT_TENDER_FEEDS.map(async (feedUrl) => {
      const res = await fetch(feedUrl, { cache: "no-store" }).catch(() => null);
      if (!res || !res.ok) {
        return [];
      }

      const xml = await res.text();
      return parseRSS(xml, "etenders");
    })
  );

  return feeds.flat().map((item, index) => {
    const parsed = parseTender({
      id: item.link || `${item.source}-${index}`,
      title: item.title,
      description: item.description,
      department: item.source,
      closingDate: item.pubDate,
    });

    return {
      ...parsed,
      deadlineSoon: false,
      score: scoreTender(parsed),
    };
  });
}