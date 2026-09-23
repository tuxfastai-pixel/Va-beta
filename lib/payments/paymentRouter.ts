type ClientLike = {
  country?: string | null;
};

export function choosePaymentMethod(client: ClientLike) {
  const country = String(client.country || "").toUpperCase();

  if (country === "ZA" || country.includes("SOUTH AFRICA")) {
    return ["PayFast", "EFT"];
  }

  if (country && country !== "ZA") {
    return ["Wise", "PayPal"];
  }

  return ["Bank Transfer"];
}
