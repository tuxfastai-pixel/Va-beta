type SheetApi = {
  spreadsheets: {
    create: (args: Record<string, unknown>) => Promise<{ data: { spreadsheetId?: string | null } }>;
    values: {
      append: (args: Record<string, unknown>) => Promise<unknown>;
    };
  };
};

export async function createCRM(sheets: SheetApi) {
  const res = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: "AI Job Tracker CRM" },
      sheets: [{ properties: { title: "Leads" } }, { properties: { title: "Applications" } }, { properties: { title: "Deals" } }],
    },
  });

  return res.data.spreadsheetId || "";
}

export async function logApplication(
  sheets: SheetApi,
  spreadsheetId: string,
  job: { title?: string; platform?: string; status?: string }
) {
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "Applications!A:D",
    valueInputOption: "RAW",
    requestBody: {
      values: [[new Date().toISOString(), String(job.title || ""), String(job.platform || ""), String(job.status || "applied")]],
    },
  });
}
