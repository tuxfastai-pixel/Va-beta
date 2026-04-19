type SupportedCurrency = "USD" | "GBP" | "EUR" | "AED";

export function convertCurrency(amount: number, currency: SupportedCurrency) {
  const rates: Record<SupportedCurrency, number> = {
    USD: 1,
    GBP: 0.79,
    EUR: 0.92,
    AED: 3.67,
  };

  return amount * rates[currency];
}
