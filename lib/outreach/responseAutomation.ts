type ClientMessageState = {
  replied?: boolean;
  last_reply_at?: string | null;
  last_outbound_at?: string | null;
};

export function replyWithinMinutes() {
  return "I can handle this today. Should I proceed?";
}

export function sendFollowUp() {
  return "Quick follow-up: I can handle this today and deliver fast. Want me to proceed?";
}

export function buildClientReply(client: ClientMessageState) {
  if (client.replied) {
    return replyWithinMinutes();
  }

  const lastOutbound = client.last_outbound_at ? new Date(client.last_outbound_at).getTime() : 0;
  const hours = lastOutbound > 0 ? (Date.now() - lastOutbound) / (1000 * 60 * 60) : 0;

  if (!client.replied && hours > 12) {
    return sendFollowUp();
  }

  return null;
}
