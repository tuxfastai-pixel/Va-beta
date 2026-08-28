type Platform = "indeed" | "linkedin" | "flexjobs" | string;

export function generatePlatformResponse(platform: Platform, _context: Record<string, unknown> = {}) {
  if (platform === "indeed") {
    return "I can handle this. I will keep everything organized and running smoothly. I can start immediately.";
  }

  if (platform === "linkedin") {
    return "I came across this and can help streamline your workflow. Happy to start small and build from there.";
  }

  if (platform === "flexjobs") {
    return "I use a structured approach to manage tasks, follow-ups, and reporting. Happy to begin with a small scope.";
  }

  return "I can help with this.";
}
