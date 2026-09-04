/**
 * Generate payment link based on region and amount
 * Supports multiple payment methods for global + SA markets
 */

export function generatePaymentLink(
  amount: number,
  region: "south_africa" | "global" = "global",
  reference?: string
): string {
  if (region === "south_africa") {
    // PayFast for South African clients
    return generatePayFastLink(amount, reference);
  }

  // Wise for global clients
  return generateWiseLink(amount, reference);
}

/**
 * Generate PayFast payment link for ZA clients
 * PayFast URL: https://payfast.io/eng/process?merchant_id=...&item_name=...&amount=...
 */
function generatePayFastLink(amount: number, reference?: string): string {
  const merchantId = process.env.PAYFAST_MERCHANT_ID || "10000100";
  const merchantKey = process.env.PAYFAST_MERCHANT_KEY || "";

  // Format amount for PayFast (ZAR, 2 decimal places)
  const formattedAmount = amount.toFixed(2);

  // Build basic PayFast link
  let link = `https://www.payfast.io/eng/process?`;
  link += `merchant_id=${merchantId}`;
  link += `&item_name=${encodeURIComponent(reference || "Professional Services")}`;
  link += `&item_description=${encodeURIComponent("Payment for services rendered")}`;
  link += `&amount=${formattedAmount}`;
  link += `&currency_code=ZAR`;

  // Add reference if provided
  if (reference) {
    link += `&custom_str1=${encodeURIComponent(reference)}`;
  }

  return link;
}

/**
 * Generate Wise payment link for global clients
 * Wise URL: https://wise.com/pay?amount=...&targetCurrency=...
 */
function generateWiseLink(amount: number, reference?: string): string {
  // Default to USD for global
  const targetCurrency = "USD";
  const formattedAmount = amount.toFixed(2);

  let link = `https://wise.com/pay?`;
  link += `amount=${formattedAmount}`;
  link += `&targetCurrency=${targetCurrency}`;

  if (reference) {
    link += `&sourceAmount=${formattedAmount}`;
  }

  return link;
}

/**
 * Generate bank transfer details for manual payment
 * Used as fallback when online payment is not available
 */
export function generateBankTransferDetails(
  region: "south_africa" | "global" = "global"
): {
  accountHolder: string;
  accountNumber: string;
  bankCode: string;
  bankName: string;
  reference?: string;
} {
  if (region === "south_africa") {
    return {
      accountHolder: process.env.BANK_ACCOUNT_HOLDER || "Digital Hybrid Palms",
      accountNumber: process.env.BANK_ACCOUNT_NUMBER || "",
      bankCode: process.env.BANK_CODE || "", // SA FNB = 250655
      bankName: "First National Bank (ZA)",
    };
  }

  return {
    accountHolder: process.env.WISE_ACCOUNT_HOLDER || "Digital Hybrid Palms",
    accountNumber: process.env.WISE_ACCOUNT_NUMBER || "",
    bankCode: "", // Not typically needed for international transfers
    bankName: "Wise",
  };
}

/**
 * Get payment instructions for client
 */
export function getPaymentInstructions(
  amount: number,
  region: "south_africa" | "global" = "global"
): string {
  const paymentLink = generatePaymentLink(amount, region);
  const bankDetails = generateBankTransferDetails(region);

  if (region === "south_africa") {
    return `
Payment Options for R${amount.toLocaleString("en-ZA", {
      minimumFractionDigits: 2,
    })}:

Option 1: Online Payment (Recommended)
${paymentLink}

Option 2: Bank Transfer
Account Holder: ${bankDetails.accountHolder}
Account Number: ${bankDetails.accountNumber}
Bank Code: ${bankDetails.bankCode}
Bank: ${bankDetails.bankName}

Please reference your invoice number in the payment description.
`;
  }

  return `
Payment Options for $${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
  })}:

Option 1: Online Payment (Recommended)
${paymentLink}

Option 2: International Transfer via Wise
Account Holder: ${bankDetails.accountHolder}
Account Number: ${bankDetails.accountNumber}

Please reference your invoice number in the payment description.
`;
}
