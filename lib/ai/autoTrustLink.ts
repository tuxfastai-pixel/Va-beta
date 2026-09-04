export function attachPortfolio(message: string) {
  const portfolioUrl = process.env.NEXT_PUBLIC_APP_URL
    ? `${String(process.env.NEXT_PUBLIC_APP_URL).replace(/\/$/, "")}/portfolio`
    : "https://yourdomain.com/portfolio";

  return `${message}\n\nYou can also see how I work here:\n${portfolioUrl}`;
}
