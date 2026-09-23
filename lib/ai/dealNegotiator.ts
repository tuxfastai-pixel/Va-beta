export function handlePricePushback(price: { minimum: number; recommended: number }) {
  return `I understand. The goal is to take this completely off your plate and keep it running consistently. If needed, I can reduce scope and focus on the core task at $${price.minimum}, or we can proceed with the full scope at $${price.recommended}.`;
}
