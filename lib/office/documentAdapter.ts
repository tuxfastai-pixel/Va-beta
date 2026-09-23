export function documentAdapter(provider: string) {
  void provider;

  return {
    async create({ title, content }: { title: string; content: string }) {
      return {
        docId: `doc_${Date.now()}`,
        title,
        content,
      };
    },
  };
}
