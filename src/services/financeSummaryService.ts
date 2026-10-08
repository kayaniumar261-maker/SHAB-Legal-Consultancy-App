import { supabase } from '../lib/supabase';
import { readAllRows } from './paginatedRead';
import type { CreditNote } from '../types/creditNote';
import type { Invoice } from '../types/invoice';
import type { Payment } from '../types/payment';
import type { PaymentReversal } from '../types/paymentReversal';
import type { ClientFundReceipt, ClientFundReversal, PaymentAllocation, PaymentAllocationReversal } from '../types/clientFunds';

export type AuthoritativeFinanceSummary = {
  currency: string | null;
  hasMixedCurrencies: boolean;
  totalBilled: number;
  totalCredited: number;
  netBillable: number;
  grossCollected: number;
  totalReversed: number;
  netCollected: number;
  outstanding: number;
};

export const EMPTY_FINANCE_SUMMARY: AuthoritativeFinanceSummary = {
  currency: 'AED',
  hasMixedCurrencies: false,
  totalBilled: 0,
  totalCredited: 0,
  netBillable: 0,
  grossCollected: 0,
  totalReversed: 0,
  netCollected: 0,
  outstanding: 0,
};

type ScopeField = 'client_id' | 'case_id';

export async function getClientFinanceSummaries(
  clientIds: string[],
): Promise<Record<string, AuthoritativeFinanceSummary>> {
  return getFinanceSummaries('client_id', clientIds);
}

export async function getCaseFinanceSummaries(
  caseIds: string[],
): Promise<Record<string, AuthoritativeFinanceSummary>> {
  return getFinanceSummaries('case_id', caseIds);
}

async function getFinanceSummaries(
  scopeField: ScopeField,
  scopeIds: string[],
): Promise<Record<string, AuthoritativeFinanceSummary>> {
  const uniqueIds = [...new Set(scopeIds.filter(Boolean))];

  if (uniqueIds.length === 0) {
    return {};
  }

  const [invoices, payments, creditNotes] =
    await Promise.all([
      readAllRows<Invoice>(() => supabase.from('invoices').select('*').in(scopeField, uniqueIds).order('id')),
      readAllRows<Payment>(() => supabase.from('payments').select('*').in(scopeField, uniqueIds).order('id')),
      readAllRows<CreditNote>(() => supabase.from('credit_notes').select('*').in(scopeField, uniqueIds).order('id')),
    ]);
  const invoiceIds = invoices.map((invoice) => invoice.id);
  let paymentReversals: PaymentReversal[] = [];

  if (invoiceIds.length > 0) {
    paymentReversals = await readAllRows<PaymentReversal>(() => supabase
      .from('payment_reversals')
      .select('*')
      .in('invoice_id', invoiceIds).order('id'));
  }

  let clientFundReceipts: ClientFundReceipt[] = [];
  let clientFundReversals: ClientFundReversal[] = [];
  let paymentAllocations: PaymentAllocation[] = [];
  let paymentAllocationReversals: PaymentAllocationReversal[] = [];

  if (scopeField === 'client_id') {
    clientFundReceipts = await readAllRows<ClientFundReceipt>(() => supabase.from('client_fund_receipts').select('*').in('client_id', uniqueIds).order('id'));
    const receiptIds = clientFundReceipts.map((receipt) => receipt.id);
    if (receiptIds.length > 0) {
      clientFundReversals = await readAllRows<ClientFundReversal>(() => supabase.from('client_fund_reversals').select('*').in('receipt_id', receiptIds).order('id'));
    }
  } else if (invoiceIds.length > 0) {
    paymentAllocations = await readAllRows<PaymentAllocation>(() => supabase.from('payment_allocations').select('*').in('invoice_id', invoiceIds).order('id'));
    const allocationIds = paymentAllocations.map((allocation) => allocation.id);
    if (allocationIds.length > 0) {
      paymentAllocationReversals = await readAllRows<PaymentAllocationReversal>(() => supabase.from('payment_allocation_reversals').select('*').in('allocation_id', allocationIds).order('id'));
    }
  }

  const invoiceScope = new Map(
    invoices.map((invoice) => [
      invoice.id,
      scopeField === 'client_id' ? invoice.client_id : invoice.case_id,
    ]),
  );

  return Object.fromEntries(
    uniqueIds.map((scopeId) => {
      const scopedInvoices = invoices.filter(
        (invoice) => invoice[scopeField] === scopeId,
      );
      const scopedPayments = payments.filter(
        (payment) => payment[scopeField] === scopeId,
      );
      const scopedCreditNotes = creditNotes.filter(
        (creditNote) => creditNote[scopeField] === scopeId,
      );
      const scopedReversals = paymentReversals.filter(
        (reversal) => invoiceScope.get(reversal.invoice_id) === scopeId,
      );

      const summary = calculateFinanceSummary(
          scopedInvoices,
          scopedPayments,
          scopedCreditNotes,
          scopedReversals,
        );
      const scopedInvoiceIds = new Set(scopedInvoices.map((invoice) => invoice.id));
      const scopedReceipts = clientFundReceipts.filter((receipt) => receipt.client_id === scopeId);
      const scopedReceiptIds = new Set(scopedReceipts.map((receipt) => receipt.id));
      const scopedFundReversals = clientFundReversals.filter((reversal) => scopedReceiptIds.has(reversal.receipt_id));
      const scopedAllocations = paymentAllocations.filter((allocation) => scopedInvoiceIds.has(allocation.invoice_id));
      const scopedAllocationIds = new Set(scopedAllocations.map((allocation) => allocation.id));
      const scopedAllocationReversals = paymentAllocationReversals.filter((reversal) => scopedAllocationIds.has(reversal.allocation_id));
      const fundGross = sum(scopeField === 'client_id' ? scopedReceipts.map((row) => row.amount) : scopedAllocations.map((row) => row.amount));
      const fundReversed = sum(scopeField === 'client_id' ? scopedFundReversals.map((row) => row.amount) : scopedAllocationReversals.map((row) => row.amount));
      const fundCurrencies = scopeField === 'client_id'
        ? scopedReceipts.map((row) => row.currency)
        : scopedAllocations.map((row) => scopedInvoices.find((invoice) => invoice.id === row.invoice_id)?.currency);
      const hasFinancialRecords =
        scopedInvoices.some((row) => !['draft', 'cancelled', 'written_off'].includes(row.status)) ||
        scopedPayments.some((row) => ['completed', 'refunded'].includes(row.status)) ||
        scopedCreditNotes.some((row) => row.status === 'issued') || scopedReversals.length > 0;
      const currencies = new Set([
        ...(summary.currency && hasFinancialRecords ? [summary.currency] : []),
        ...fundCurrencies.map((value) => value?.trim().toUpperCase()).filter((value): value is string => Boolean(value)),
      ]);
      const grossCollected = summary.grossCollected + fundGross;
      const totalReversed = summary.totalReversed + fundReversed;

      return [scopeId, {
        ...summary,
        currency: summary.hasMixedCurrencies || currencies.size > 1 ? null : ([...currencies][0] ?? 'AED'),
        hasMixedCurrencies: summary.hasMixedCurrencies || currencies.size > 1,
        grossCollected,
        totalReversed,
        netCollected: Math.max(0, grossCollected - totalReversed),
      }];
    }),
  );
}

export function calculateFinanceSummary(
  invoices: Invoice[],
  payments: Payment[],
  creditNotes: CreditNote[],
  paymentReversals: PaymentReversal[],
): AuthoritativeFinanceSummary {
  const billableInvoices = invoices.filter(
    (invoice) =>
      !['draft', 'cancelled', 'written_off'].includes(invoice.status),
  );
  const collectedPayments = payments.filter((payment) =>
    ['completed', 'refunded'].includes(payment.status),
  );
  const issuedCreditNotes = creditNotes.filter(
    (creditNote) => creditNote.status === 'issued',
  );
  const currencies = new Set(
    [
      ...billableInvoices.map((row) => row.currency),
      ...collectedPayments.map((row) => row.currency),
      ...issuedCreditNotes.map((row) => row.currency),
      ...paymentReversals.map((row) => row.currency),
    ]
      .map((currency) => currency?.trim().toUpperCase())
      .filter(Boolean),
  );
  const totalBilled = sum(billableInvoices.map((row) => row.total_amount));
  const totalCredited = sum(
    issuedCreditNotes.map((row) => row.total_amount),
  );
  const grossCollected = sum(collectedPayments.map((row) => row.amount));
  const totalReversed = sum(paymentReversals.map((row) => row.amount));

  return {
    currency: currencies.size === 1 ? [...currencies][0] : currencies.size ? null : 'AED',
    hasMixedCurrencies: currencies.size > 1,
    totalBilled,
    totalCredited,
    netBillable: Math.max(0, totalBilled - totalCredited),
    grossCollected,
    totalReversed,
    netCollected: Math.max(0, grossCollected - totalReversed),
    outstanding: sum(
      invoices
        .filter(
          (invoice) =>
            ![
              'draft',
              'cancelled',
              'written_off',
              'paid',
              'credited',
            ].includes(invoice.status),
        )
        .map((invoice) => invoice.balance_amount),
    ),
  };
}

function sum(values: Array<number | string | null | undefined>): number {
  return values.reduce<number>(
    (total, value) => total + Number(value ?? 0),
    0,
  );
}
