type MarketStrategy = {
  market: string;
  strategy: string;
};

const marketStrategies: MarketStrategy[] = [
  { market: "USA", strategy: "freelance / tech" },
  { market: "UK", strategy: "admin / support" },
  { market: "Dubai", strategy: "business / CRM" },
];

export function getMarketStrategy(market: string) {
  return marketStrategies.find((entry) => entry.market === market);
}

export function getAllMarketStrategies() {
  return marketStrategies;
}
