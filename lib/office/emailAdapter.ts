export function emailAdapter(provider: string) {
  void provider;

  return {
    async send({ to, subject, body }: { to: string; subject: string; body: string }) {
      console.log("Sending email:", { to, subject, bodyLength: body.length });
      return { success: true };
    },
  };
}
