import { trustAssets } from "@/lib/trust/trustAssets";

export function buildTrustResponse(type: string) {
  if (type === "proof_request") {
    return `
I understand - instead of traditional references, I usually show exactly how I work.

${trustAssets.samples.crm}

${trustAssets.samples.email}

${trustAssets.demoScript}
`;
  }

  if (type === "trust_objection") {
    return `
That's completely fair.

I focus on keeping things simple and reliable:

${trustAssets.caseStudies[0].summary}

${trustAssets.demoScript}
`;
  }

  return null;
}

export function localizeTrustResponse(response: string, region: string) {
  if (region === "ZA") {
    return `${response}\n\nHappy to keep things flexible and straightforward.`;
  }

  if (region === "GLOBAL") {
    return `${response}\n\nHappy to start with a small task to demonstrate value.`;
  }

  return response;
}
