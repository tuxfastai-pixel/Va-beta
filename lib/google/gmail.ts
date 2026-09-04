type GmailApi = {
  users: {
    messages: {
      send: (args: Record<string, unknown>) => Promise<unknown>;
    };
  };
};

export async function sendFollowUp(gmail: GmailApi, to: string, message: string) {
  const encodedMessage = Buffer.from(`To: ${to}\r\nSubject: Quick follow-up\r\n\r\n${message}`)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: encodedMessage,
    },
  });
}
