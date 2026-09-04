export function trackTender(tender: { id?: string | number; title?: string; closingDate?: string | Date }) {
  return {
    id: String(tender.id || ""),
    title: String(tender.title || "Untitled"),
    deadline: new Date(tender.closingDate || new Date()),
    status: "open",
  };
}