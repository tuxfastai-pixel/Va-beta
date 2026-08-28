type CalendarApi = {
  events: {
    insert: (args: Record<string, unknown>) => Promise<{ data: { htmlLink?: string | null } }>;
  };
};

export async function createBooking(
  calendar: CalendarApi,
  details: {
    title?: string;
    description?: string;
    start: string;
    end: string;
    clientEmail: string;
  }
) {
  const event = {
    summary: details.title || "Client Meeting",
    description: details.description || "Discussion",
    start: {
      dateTime: details.start,
      timeZone: "UTC",
    },
    end: {
      dateTime: details.end,
      timeZone: "UTC",
    },
    attendees: [{ email: details.clientEmail }],
  };

  const res = await calendar.events.insert({
    calendarId: "primary",
    requestBody: event,
  });

  return res.data.htmlLink || "";
}
