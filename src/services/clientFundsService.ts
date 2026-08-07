import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type {
  ClientFundReceipt,
  ClientFundReversal,
  ClientFundReceiptWithAllocations,
  PaymentAllocation,
  PaymentAllocationReversal,
} from '../types/clientFunds';

function unwrap<T>(result: { data: T | null; error: PostgrestError | null }): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error('No data returned from Supabase.');
  return result.data;
}

export async function getClientFundReceipts(clientId: string): Promise<ClientFundReceiptWithAllocations[]> {
  const rows = unwrap(await supabase
    .from('client_fund_receipts')
    .select('*, allocations:payment_allocations(*)')
    .eq('client_id', clientId)
    .order('payment_date', { ascending: false })
    .order('created_at', { ascending: false })) as Array<ClientFundReceipt & { allocations: PaymentAllocation[] }>;

  return rows.map((row) => ({
    ...row,
    allocations: row.allocations ?? [],
    available_amount: Math.max(0, Number(row.amount) - Number(row.allocated_amount) - Number(row.reversed_amount)),
  }));
}

export async function recordClientFunds(input: {
  clientId: string; caseId?: string | null; amount: number; currency: string;
  paymentDate: string; paymentMethod?: string | null; referenceNumber?: string | null;
  notes?: string | null; receivedByStaffId?: string | null;
}): Promise<ClientFundReceipt> {
  return unwrap(await supabase.rpc('shab_record_client_funds', {
    p_client_id: input.clientId, p_case_id: input.caseId ?? null, p_amount: input.amount,
    p_currency: input.currency, p_payment_date: input.paymentDate,
    p_payment_method: input.paymentMethod ?? null, p_reference_number: input.referenceNumber ?? null,
    p_notes: input.notes ?? null, p_received_by_staff_id: input.receivedByStaffId ?? null,
  })) as ClientFundReceipt;
}

export async function allocateClientFunds(input: {
  receiptId: string; invoiceId: string; amount: number; allocationDate: string; notes?: string | null;
}): Promise<PaymentAllocation> {
  return unwrap(await supabase.rpc('shab_allocate_client_funds', {
    p_receipt_id: input.receiptId, p_invoice_id: input.invoiceId, p_amount: input.amount,
    p_allocation_date: input.allocationDate, p_notes: input.notes ?? null,
  })) as PaymentAllocation;
}

export async function reversePaymentAllocation(input: {
  allocationId: string; amount: number; reversalDate: string; reason: string;
}): Promise<PaymentAllocationReversal> {
  return unwrap(await supabase.rpc('shab_reverse_payment_allocation', {
    p_allocation_id: input.allocationId, p_amount: input.amount,
    p_reversal_date: input.reversalDate, p_reason: input.reason,
  })) as PaymentAllocationReversal;
}

export async function reverseUnallocatedClientFunds(input: {
  receiptId: string; amount: number; reversalDate: string; reason: string;
}): Promise<ClientFundReversal> {
  return unwrap(await supabase.rpc('shab_reverse_unallocated_client_funds', {
    p_receipt_id: input.receiptId, p_amount: input.amount,
    p_reversal_date: input.reversalDate, p_reason: input.reason,
  })) as ClientFundReversal;
}
