type GmailApi = {
  users: {
    messages: {
      list: (args: Record<string, unknown>) => Promise<{ data: { messages?: Array<{ id?: string }> } }>;
      get: (args: Record<string, unknown>) => Promise<{
        data: {
          payload?: {
            body?: { data?: string };
            parts?: Array<{ mimeType?: string; body?: { data?: string } }>;
          };
        };
      }>;
    };
  };
};

function decodeBase64Url(input: string) {
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

export async function getRecentEmails(gmail: GmailApi) {
  const res = await gmail.users.messages.list({
    userId: "me",
    maxResults: 5,
  });

  return res.data.messages || [];
}

export async function getEmailBody(gmail: GmailApi, messageId: string) {
  const res = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  });

  const payload = res.data.payload;
  const directBody = payload?.body?.data;
  if (directBody) {
    return decodeBase64Url(directBody);
  }

  const plainTextPart = payload?.parts?.find((part) => part.mimeType === "text/plain" && part.body?.data);
  if (plainTextPart?.body?.data) {
    return decodeBase64Url(plainTextPart.body.data);
  }

  return "";
}
