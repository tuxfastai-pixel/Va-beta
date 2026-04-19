import type { Browser, Page } from "playwright";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

type BrowserPageBundle = {
  browser: Browser;
  page: Page;
};

export async function openJobPlatform(url: string): Promise<BrowserPageBundle> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(url);

  return { browser, page };
}

export async function loginUpwork(page: Page) {
  const username = process.env.UPWORK_USER || "";
  const password = process.env.UPWORK_PASS || "";

  if (!username || !password) {
    throw new Error("Missing UPWORK_USER or UPWORK_PASS in environment.");
  }

  await page.fill("#login_username", username);
  await page.fill("#login_password", password);
  await page.click("button[type=submit]");
}

export async function loginLinkedIn(page: Page) {
  const username = process.env.LINKEDIN_USER || "";
  const password = process.env.LINKEDIN_PASS || "";

  if (!username || !password) {
    throw new Error("Missing LINKEDIN_USER or LINKEDIN_PASS in environment.");
  }

  await page.fill("#username", username);
  await page.fill("#password", password);
  await page.click("button[type=submit]");
}
