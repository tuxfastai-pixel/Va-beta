export async function discoverUpworkJobs() {
  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch();

    try {
      const page = await browser.newPage();

      await page.goto("https://www.upwork.com/nx/search/jobs/?q=virtual%20assistant");

      const jobs = await page.$$eval(".job-tile", (nodes) =>
        nodes.map((n) => ({
          title: n.querySelector("h4")?.textContent,
          description: n.querySelector(".job-description")?.textContent,
          company: "Upwork Client",
          country: "Global",
          currency: "USD",
          pay_amount: 25,
        }))
      );

      return jobs;
    } finally {
      await browser.close();
    }
  } catch (error) {
    console.warn("Upwork discovery skipped:", error);
    return [];
  }
}
