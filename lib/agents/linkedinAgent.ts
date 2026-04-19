import { chromium } from "playwright";
import type { BrowserContextOptions } from "playwright";

export const LINKEDIN_STRATEGY = "Search -> Qualify -> Personalize -> Send -> Track -> Follow-up";

export type LinkedInSessionState = Exclude<BrowserContextOptions["storageState"], string | undefined>;

type LinkedInLead = {
  name: string;
  email?: string;
  replied?: boolean;
  message?: string;
  job?: Record<string, unknown>;
};

export function generateLinkedInMessage(name: string) {
  return [
    `Hi ${name},`,
    "",
    "I came across your profile and noticed your work.",
    "",
    "We've built an autonomous system that executes tasks like:",
    "- automation",
    "- feature development",
    "- AI system optimization",
    "",
    "Would you be open to a quick chat?",
    "",
    "Best,",
    "AI Execution Team",
  ].join("\n");
}

export async function runLinkedInAgent(session?: LinkedInSessionState | string | null) {
  const headless = String(process.env.LINKEDIN_HEADLESS || "false") === "true";
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({
    storageState: session || undefined,
  });
  const page = await context.newPage();

  await page.goto("https://www.linkedin.com/login", { waitUntil: "domcontentloaded" });

  // Login manually once, then save session/cookies in a future upgrade.
  await page.goto("https://www.linkedin.com/search/results/people/?keywords=founder", {
    waitUntil: "domcontentloaded",
  });

  await page.waitForSelector(".entity-result");

  const profiles = await page.$$(".entity-result");

  for (const profile of profiles.slice(0, 5)) {
    const name = (await profile.innerText()).split("\n")[0]?.trim() || "there";
    const message = generateLinkedInMessage(name);

    console.log("Sending to:", name);
    console.log(message);

    // Future upgrade: auto-connect + send note.
  }

  await context.close();
  await browser.close();
}

export function leadsToVolume(inputLeads: LinkedInLead[]): LinkedInLead[] {
  return inputLeads.filter((lead) => Boolean(lead.name)).slice(0, 200);
}
