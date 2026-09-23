export type PlatformRegistryEntry = {
  name: string;
  region: "global" | "ZA";
  type: "aggregator" | "network" | "remote" | "corporate" | "general";
  weight: number;
};

export const platforms: PlatformRegistryEntry[] = [
  { name: "indeed", region: "global", type: "aggregator", weight: 0.9 },
  { name: "linkedin", region: "global", type: "network", weight: 1.0 },
  { name: "flexjobs", region: "global", type: "remote", weight: 0.95 },
  { name: "pnet", region: "ZA", type: "corporate", weight: 0.7 },
  { name: "careerjunction", region: "ZA", type: "corporate", weight: 0.75 },
  { name: "careers24", region: "ZA", type: "general", weight: 0.6 },
];

export const PLATFORMS = Object.fromEntries(
  platforms.map((platform) => [
    platform.name,
    {
      enabled: true,
      type: platform.type,
      region: platform.region,
      weight: platform.weight,
    },
  ])
) as Record<string, { enabled: boolean; type: PlatformRegistryEntry["type"]; region: PlatformRegistryEntry["region"]; weight: number }>;

export function getPlatformWeight(platformName: string | null | undefined) {
  const normalizedName = String(platformName || "").toLowerCase();
  const entry = platforms.find((platform) => platform.name === normalizedName);
  return entry?.weight ?? 0.5;
}
