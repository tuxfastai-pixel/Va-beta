type Market = {
  name: string;
  avgPay: number;
};

type UserProfile = {
  id?: string;
  skills?: string[];
};

export function selectBestMarket(user: UserProfile) {
  const markets: Market[] = [
    { name: "USA", avgPay: 40 },
    { name: "UK", avgPay: 35 },
    { name: "Dubai", avgPay: 38 },
  ];

  void user;

  return markets.sort((a, b) => b.avgPay - a.avgPay)[0];
}
