import { supabase } from '../lib/supabase';
import type { CreditNote } from '../types/creditNote';
import type { Invoice } from '../types/invoice';
import type { Payment } from '../types/payment';
import type { PaymentReversal } from '../types/paymentReversal';

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

  const [invoiceResult, paymentResult, creditNoteResult] =
    await Promise.all([
      supabase.from('invoices').select('*').in(scopeField, uniqueIds),
      supabase.from('payments').select('*').in(scopeField, uniqueIds),
      supabase.from('credit_notes').select('*').in(scopeField, uniqueIds),
    ]);

  const error =
    invoiceResult.error ?? paymentResult.error ?? creditNoteResult.error;

  if (error) {
    throw new Error(error.message);
  }

  const invoices = (invoiceResult.data ?? []) as Invoice[];
  const payments = (paymentResult.data ?? []) as Payment[];
  const creditNotes = (creditNoteResult.data ?? []) as CreditNote[];
  const invoiceIds = invoices.map((invoice) => invoice.id);
  let paymentReversals: PaymentReversal[] = [];

  if (invoiceIds.length > 0) {
    const reversalResult = await supabase
      .from('payment_reversals')
      .select('*')
      .in('invoice_id', invoiceIds);

    if (reversalResult.error) {
      throw new Error(reversalResult.error.message);
    }

    paymentReversals =
      (reversalResult.data ?? []) as PaymentReversal[];
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

      return [
        scopeId,
        calculateFinanceSummary(
          scopedInvoices,
          scopedPayments,
          scopedCreditNotes,
          scopedReversals,
        ),
      ];
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
