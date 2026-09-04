type RSSItem = {
  title: string;
  description: string;
  link: string;
  pubDate: string;
  source: string;
};

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function getTagValue(block: string, tag: string) {
  const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return decodeXml(match?.[1] || "");
}

export function parseRSS(xml: string, source: string): RSSItem[] {
  const items = xml.match(/<item>([\s\S]*?)<\/item>/gi) || [];

  return items.map((item) => ({
    title: getTagValue(item, "title"),
    description: getTagValue(item, "description"),
    link: getTagValue(item, "link"),
    pubDate: getTagValue(item, "pubDate"),
    source,
  }));
}