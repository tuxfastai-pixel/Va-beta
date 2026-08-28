export function calendarAdapter(provider: string) {
  void provider;

  return {
    async schedule({ title, time }: { title: string; time: string }) {
      return {
        scheduled: true,
        title,
        time,
      };
    },
  };
}
