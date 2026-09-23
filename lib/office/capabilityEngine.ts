import { calendarAdapter } from "@/lib/office/calendarAdapter";
import { documentAdapter } from "@/lib/office/documentAdapter";
import { emailAdapter } from "@/lib/office/emailAdapter";
import { spreadsheetAdapter } from "@/lib/office/spreadsheetAdapter";

export type Capability =
  | "spreadsheet.create"
  | "spreadsheet.append"
  | "spreadsheet.read"
  | "document.create"
  | "email.send"
  | "calendar.schedule";

export async function runCapability(
  capability: Capability,
  payload: Record<string, unknown>,
  context: { provider?: string }
) {
  const provider = context.provider || "google";

  switch (capability) {
    case "spreadsheet.create":
      return spreadsheetAdapter(provider).create(payload as { title: string; headers: string[] });
    case "spreadsheet.append":
      return spreadsheetAdapter(provider).append(payload as { sheetId: string; row: unknown[] });
    case "spreadsheet.read":
      return spreadsheetAdapter(provider).read(payload as { sheetId: string });
    case "document.create":
      return documentAdapter(provider).create(payload as { title: string; content: string });
    case "email.send":
      return emailAdapter(provider).send(payload as { to: string; subject: string; body: string });
    case "calendar.schedule":
      return calendarAdapter(provider).schedule(payload as { title: string; time: string });
    default:
      return null;
  }
}
