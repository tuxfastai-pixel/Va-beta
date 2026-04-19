type UserProfileLike = {
  skills?: unknown;
  interests?: unknown;
};

function toList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) {
    return value
      .split(/[;,]/)
      .map((v) => v.trim())
      .filter(Boolean);
  }

  return [];
}

export function detectUserNiche(userProfile: UserProfileLike): string[] {
  const skills = toList(userProfile?.skills);
  if (skills.length > 0) return skills;

  const interests = toList(userProfile?.interests);
  if (interests.length > 0) return interests;

  return ["general"];
}
