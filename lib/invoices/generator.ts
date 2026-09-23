import { supabaseServer } from "@/lib/supabaseServer";
import { generatePaymentLink } from "@/lib/payments/linkGenerator";
import type { Deal } from "@/lib/crm/dealManager";
import type { Client } from "@/lib/crm/clientManager";

export interface Invoice {
  id?: string;
  deal_id: string;
  amount: number;
  description?: string;
  status?: "pending" | "sent" | "paid" | "overdue" | "cancelled";
  payment_link?: string;
  due_date: Date;
  paid_at?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Generate invoice number (format: INV-YYYYMMDD-XXXX)
 */
export function generateInvoiceNumber(): string {
  const now = new Date();
  const date = now
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "");
  const random = Math.floor(Math.random() * 9000) + 1000;
  return `INV-${date}-${random}`;
}

/**
 * Create invoice template content
 */
export function generateInvoiceContent(
  invoiceNumber: string,
  client: Client,
  deal: Deal,
  amount: number,
  dueDate: Date,
  company: string = "Digital Hybrid Palms (Pty) Ltd"
): string {
  const createdDate = new Date();

  return `
INVOICE

Invoice Number: ${invoiceNumber}
Invoice Date: ${createdDate.toLocaleDateString()}
Due Date: ${dueDate.toLocaleDateString()}

FROM:
${company}
South Africa

BILL TO:
${client.name}
${client.email}
${client.phone || ""}

DESCRIPTION OF SERVICES:
${deal.title}

AMOUNT: R${amount.toLocaleString("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}

TOTAL DUE: R${amount.toLocaleString("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}

Payment Terms: Net ${Math.floor((dueDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24))} days

Please remit payment to the details provided.
`;
}

/**
 * Create invoice in database
 */
export async function createInvoice(
  dealId: string,
  amount: number,
  dueDate: Date = new Date(Date.now() + 7 * 86400000), // 7 days default
  description?: string
): Promise<Invoice | null> {
  try {
    // Generate payment link based on region (will be populated after client fetch if needed)
    const paymentLink = generatePaymentLink(amount, "south_africa"); // Default to ZA

    const { data, error } = await supabaseServer
      .from("invoices")
      .insert([
        {
          deal_id: dealId,
          amount,
          description,
          status: "pending",
          payment_link: paymentLink,
          due_date: dueDate.toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("[invoiceManager] Error creating invoice:", error);
      return null;
    }

    return data;
  } catch (err) {
    console.error("[invoiceManager] Unexpected error:", err);
    return null;
  }
}

/**
 * Get invoice by deal
 */
export async function getInvoiceByDeal(dealId: string): Promise<Invoice | null> {
  try {
    const { data, error } = await supabaseServer
      .from("invoices")
      .select("*")
      .eq("deal_id", dealId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("[invoiceManager] Error fetching invoice:", error);
      return null;
    }

    return data || null;
  } catch (err) {
    console.error("[invoiceManager] Unexpected error:", err);
    return null;
  }
}

/**
 * Get invoice by ID
 */
export async function getInvoice(invoiceId: string): Promise<Invoice | null> {
  try {
    const { data, error } = await supabaseServer
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .single();

    if (error) {
      console.error("[invoiceManager] Error fetching invoice:", error);
      return null;
    }

    return data;
  } catch (err) {
    console.error("[invoiceManager] Unexpected error:", err);
    return null;
  }
}

/**
 * Update invoice status
 */
export async function updateInvoiceStatus(
  invoiceId: string,
  status: "pending" | "sent" | "paid" | "overdue" | "cancelled"
): Promise<Invoice | null> {
  try {
    const updateData: { status: typeof status; updated_at: string; paid_at?: string } = {
      status,
      updated_at: new Date().toISOString(),
    };

    // If marking as paid, set paid_at
    if (status === "paid") {
      updateData.paid_at = new Date().toISOString();
    }

    const { data, error } = await supabaseServer
      .from("invoices")
      .update(updateData)
      .eq("id", invoiceId)
      .select()
      .single();

    if (error) {
      console.error("[invoiceManager] Error updating invoice:", error);
      return null;
    }

    return data;
  } catch (err) {
    console.error("[invoiceManager] Unexpected error:", err);
    return null;
  }
}

/**
 * Get unpaid invoices
 */
export async function getUnpaidInvoices(): Promise<Invoice[]> {
  try {
    const { data, error } = await supabaseServer
      .from("invoices")
      .select("*")
      .in("status", ["pending", "sent", "overdue"])
      .order("due_date", { ascending: true });

    if (error) {
      console.error("[invoiceManager] Error fetching unpaid invoices:", error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("[invoiceManager] Unexpected error:", err);
    return [];
  }
}

/**
 * Get overdue invoices
 */
export async function getOverdueInvoices(): Promise<Invoice[]> {
  try {
    const now = new Date();

    const { data, error } = await supabaseServer
      .from("invoices")
      .select("*")
      .in("status", ["pending", "sent"])
      .lt("due_date", now.toISOString())
      .order("due_date", { ascending: true });

    if (error) {
      console.error("[invoiceManager] Error fetching overdue invoices:", error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("[invoiceManager] Unexpected error:", err);
    return [];
  }
}

/**
 * Mark overdue invoices (helper for orchestrator)
 */
export async function markOverdueInvoices(): Promise<number> {
  try {
    const overdue = await getOverdueInvoices();
    let updated = 0;

    for (const invoice of overdue) {
      const result = await updateInvoiceStatus(invoice.id || "", "overdue");
      if (result) updated++;
    }

    return updated;
  } catch (err) {
    console.error("[invoiceManager] Error marking overdue:", err);
    return 0;
  }
}
