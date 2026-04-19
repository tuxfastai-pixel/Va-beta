import { supabaseServer } from "@/lib/supabaseServer";

type InvoiceInput = {
  client: string;
  amount: number;
  job: string;
  currency?: string;
};

export function generateInvoice({ client, amount, job, currency = "USD" }: InvoiceInput) {
  return {
    invoice_number: `INV-${Date.now()}`,
    client,
    amount,
    job,
    currency: currency.toUpperCase(),
    status: "pending" as const,
    created_at: new Date().toISOString(),
  };
}

export async function createInvoiceRecord(params: {
  clientId: string;
  taskId: string;
  amount: number;
  currency?: string;
}) {
  const invoice = generateInvoice({
    client: params.clientId,
    amount: params.amount,
    job: params.taskId,
    currency: params.currency || "USD",
  });

  const { data, error } = await supabaseServer
    .from("invoices")
    .insert({
      client_id: invoice.client,
      task_id: invoice.job,
      amount: invoice.amount,
      currency: invoice.currency,
      status: invoice.status,
      created_at: invoice.created_at,
    })
    .select("id, client_id, task_id, amount, currency, status, created_at")
    .single();

  if (error) {
    throw new Error(`Failed to create invoice: ${error.message}`);
  }

  return {
    invoice,
    dbInvoice: data,
  };
}
