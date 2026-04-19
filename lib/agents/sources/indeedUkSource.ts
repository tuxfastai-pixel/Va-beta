export async function discoverIndeedUKJobs() {
  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch();

    try {
      const page = await browser.newPage();

      await page.goto("https://uk.indeed.com/jobs?q=remote+assistant");

      const jobs = await page.$$eval(".job_seen_beacon", (nodes) =>
        nodes.map((n) => ({
          title: n.querySelector("h2")?.textContent,
          company: n.querySelector(".companyName")?.textContent,
          country: "United Kingdom",
          currency: "GBP",
          pay_amount: 20,
        }))
      );

      return jobs;
    } finally {
      await browser.close();
    }
  } catch (error) {
    console.warn("Indeed UK discovery skipped:", error);
    return [];
  }
}
