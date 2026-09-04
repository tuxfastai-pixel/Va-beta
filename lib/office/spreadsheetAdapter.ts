import { excelAdapter } from "@/lib/office/excelAdapter";
import { googleSheetsAdapter } from "@/lib/office/googleSheetsAdapter";

export function spreadsheetAdapter(provider: string) {
  if (provider === "google") {
    return googleSheetsAdapter;
  }

  return excelAdapter;
}
