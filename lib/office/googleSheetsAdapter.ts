type SheetCreatePayload = {
  title: string;
  headers: string[];
};

type SheetAppendPayload = {
  sheetId: string;
  row: unknown[];
};

type SheetReadPayload = {
  sheetId: string;
};

const inMemorySheets = new Map<string, { title: string; headers: string[]; rows: unknown[][] }>();

export const googleSheetsAdapter = {
  async create({ title, headers }: SheetCreatePayload) {
    const sheetId = `gs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    inMemorySheets.set(sheetId, {
      title,
      headers,
      rows: [],
    });

    return {
      sheetId,
      title,
      headers,
    };
  },

  async append({ sheetId, row }: SheetAppendPayload) {
    const sheet = inMemorySheets.get(sheetId);
    if (!sheet) {
      return { success: false, reason: "sheet_not_found" };
    }

    sheet.rows.push(Array.isArray(row) ? row : [row]);
    return { success: true };
  },

  async read({ sheetId }: SheetReadPayload) {
    const sheet = inMemorySheets.get(sheetId);
    if (!sheet) {
      return [];
    }

    return [sheet.headers, ...sheet.rows];
  },
};
