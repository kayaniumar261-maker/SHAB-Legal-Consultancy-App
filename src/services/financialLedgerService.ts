import type {
  PostgrestError,
} from '@supabase/supabase-js';

import { supabase } from '../lib/supabase';

import type { Invoice } from '../types/invoice';
import type { Payment } from '../types/payment';
import type { CreditNote } from '../types/creditNote';
import type {
  PaymentReversal,
} from '../types/paymentReversal';
import type {
  ClientFundReceipt,
  ClientFundReversal,
  PaymentAllocation,
  PaymentAllocationReversal,
} from '../types/clientFunds';
import { calculateFinanceSummary } from './financeSummaryService';

export type FinancialLedgerScope =
  | {
      clientId: string;
      caseId?: never;
    }
  | {
      clientId?: never;
      caseId: string;
    };

export type FinancialLedgerEntryKind =
  | 'invoice'
  | 'payment'
  | 'credit_note'
  | 'payment_reversal'
  | 'client_fund_receipt'
  | 'payment_allocation'
  | 'allocation_reversal'
  | 'client_fund_reversal';

export type FinancialLedgerEntry = {
  id: string;
  kind: FinancialLedgerEntryKind;

  date: string;
  createdAt: string;

  documentNumber: string;
  relatedDocumentNumber: string | null;

  clientId: string | null;
  caseId: string | null;
  invoiceId: string | null;
  paymentId: string | null;

  description: string;
  status: string;

  amount: number;
  currency: string;

  invoice: Invoice | null;
  payment: Payment | null;
  creditNote: CreditNote | null;
  paymentReversal: PaymentReversal | null;
};

export type FinancialLedgerSummary = {
  invoiceCount: number;
  paymentCount: number;
  creditNoteCount: number;
  reversalCount: number;

  totalBilled: number;
  grossCollected: number;
  totalCredited: number;
  totalReversed: number;
  netCollected: number;
  outstanding: number;

  collectionRate: number;
};

export type FinancialLedger = {
  invoices: Invoice[];
  payments: Payment[];
  creditNotes: CreditNote[];
  paymentReversals: PaymentReversal[];
  clientFundReceipts: ClientFundReceipt[];
  paymentAllocations: PaymentAllocation[];
  paymentAllocationReversals: PaymentAllocationReversal[];
  clientFundReversals: ClientFundReversal[];

  entries: FinancialLedgerEntry[];
  summary: FinancialLedgerSummary;
};

function throwIfError(
  error: PostgrestError | null,
): void {
  if (error) {
    throw new Error(error.message);
  }
}

export async function getFinancialLedger(
  scope: FinancialLedgerScope,
): Promise<FinancialLedger> {
  let invoiceQuery = supabase
    .from('invoices')
    .select('*')
    .order('issue_date', {
      ascending: false,
    })
    .order('created_at', {
      ascending: false,
    });

  let paymentQuery = supabase
    .from('payments')
    .select('*')
    .order('payment_date', {
      ascending: false,
    })
    .order('created_at', {
      ascending: false,
    });

  let creditNoteQuery = supabase
    .from('credit_notes')
    .select('*')
    .order('issue_date', {
      ascending: false,
    })
    .order('created_at', {
      ascending: false,
    });

  if (scope.clientId) {
    invoiceQuery = invoiceQuery.eq(
      'client_id',
      scope.clientId,
    );

    paymentQuery = paymentQuery.eq(
      'client_id',
      scope.clientId,
    );

    creditNoteQuery = creditNoteQuery.eq(
      'client_id',
      scope.clientId,
    );
  }

  if (scope.caseId) {
    invoiceQuery = invoiceQuery.eq(
      'case_id',
      scope.caseId,
    );

    paymentQuery = paymentQuery.eq(
      'case_id',
      scope.caseId,
    );

    creditNoteQuery = creditNoteQuery.eq(
      'case_id',
      scope.caseId,
    );
  }

  const [
    invoiceResult,
    paymentResult,
    creditNoteResult,
  ] = await Promise.all([
    invoiceQuery,
    paymentQuery,
    creditNoteQuery,
  ]);

  throwIfError(invoiceResult.error);
  throwIfError(paymentResult.error);
  throwIfError(creditNoteResult.error);

  const invoices =
    (invoiceResult.data ?? []) as Invoice[];

  const payments =
    (paymentResult.data ?? []) as Payment[];

  const creditNotes =
    (creditNoteResult.data ?? []) as CreditNote[];

  const invoiceIds = invoices.map(
    (invoice) => invoice.id,
  );

  let paymentReversals: PaymentReversal[] = [];

  if (invoiceIds.length > 0) {
    const reversalResult = await supabase
      .from('payment_reversals')
      .select('*')
      .in('invoice_id', invoiceIds)
      .order('reversal_date', {
        ascending: false,
      })
      .order('created_at', {
        ascending: false,
      });

    throwIfError(reversalResult.error);

    paymentReversals =
      (reversalResult.data ??
        []) as PaymentReversal[];
  }

  let paymentAllocations: PaymentAllocation[] = [];
  if (invoiceIds.length > 0) {
    const result = await supabase.from('payment_allocations').select('*').in('invoice_id', invoiceIds);
    throwIfError(result.error);
    paymentAllocations = (result.data ?? []) as PaymentAllocation[];
  }

  const allocationIds = paymentAllocations.map((allocation) => allocation.id);
  let paymentAllocationReversals: PaymentAllocationReversal[] = [];
  if (allocationIds.length > 0) {
    const result = await supabase.from('payment_allocation_reversals').select('*').in('allocation_id', allocationIds);
    throwIfError(result.error);
    paymentAllocationReversals = (result.data ?? []) as PaymentAllocationReversal[];
  }

  let clientFundReceipts: ClientFundReceipt[] = [];
  if (scope.clientId) {
    const result = await supabase.from('client_fund_receipts').select('*').eq('client_id', scope.clientId);
    throwIfError(result.error);
    clientFundReceipts = (result.data ?? []) as ClientFundReceipt[];
  } else {
    const allocatedReceiptIds = [...new Set(paymentAllocations.map((allocation) => allocation.receipt_id))];
    const directResult = await supabase.from('client_fund_receipts').select('*').eq('case_id', scope.caseId as string);
    throwIfError(directResult.error);
    const rows = (directResult.data ?? []) as ClientFundReceipt[];
    if (allocatedReceiptIds.length > 0) {
      const allocatedResult = await supabase.from('client_fund_receipts').select('*').in('id', allocatedReceiptIds);
      throwIfError(allocatedResult.error);
      for (const receipt of (allocatedResult.data ?? []) as ClientFundReceipt[]) {
        if (!rows.some((row) => row.id === receipt.id)) rows.push(receipt);
      }
    }
    clientFundReceipts = rows;
  }

  const receiptIds = clientFundReceipts.map((receipt) => receipt.id);
  let clientFundReversals: ClientFundReversal[] = [];
  if (receiptIds.length > 0) {
    const result = await supabase.from('client_fund_reversals').select('*').in('receipt_id', receiptIds);
    throwIfError(result.error);
    clientFundReversals = (result.data ?? []) as ClientFundReversal[];
  }

  const invoiceMap = new Map(
    invoices.map(
      (invoice) => [
        invoice.id,
        invoice,
      ],
    ),
  );

  const paymentMap = new Map(
    payments.map(
      (payment) => [
        payment.id,
        payment,
      ],
    ),
  );

  const receiptMap = new Map(clientFundReceipts.map((receipt) => [receipt.id, receipt]));
  const allocationMap = new Map(paymentAllocations.map((allocation) => [allocation.id, allocation]));
  const scopedFundReceiptEntries = scope.clientId
    ? clientFundReceipts
    : clientFundReceipts.filter((receipt) => receipt.case_id === scope.caseId);
  const scopedFundReceiptEntryIds = new Set(scopedFundReceiptEntries.map((receipt) => receipt.id));
  const scopedFundReversalEntries = scope.clientId
    ? clientFundReversals
    : clientFundReversals.filter((reversal) => scopedFundReceiptEntryIds.has(reversal.receipt_id));

  const entries: FinancialLedgerEntry[] = [
    ...invoices.map(
      (invoice): FinancialLedgerEntry => ({
        id: `invoice:${invoice.id}`,
        kind: 'invoice',

        date: invoice.issue_date,
        createdAt: invoice.created_at,

        documentNumber:
          invoice.invoice_number,

        relatedDocumentNumber: null,

        clientId: invoice.client_id,
        caseId: invoice.case_id,
        invoiceId: invoice.id,
        paymentId: null,

        description:
          invoice.description ||
          'Professional services invoice',

        status: invoice.status,

        amount:
          Number(
            invoice.total_amount ?? 0,
          ),

        currency:
          invoice.currency || 'AED',

        invoice,
        payment: null,
        creditNote: null,
        paymentReversal: null,
      }),
    ),

    ...payments.map(
      (payment): FinancialLedgerEntry => {
        const invoice =
          invoiceMap.get(
            payment.invoice_id,
          ) ?? null;

        return {
          id: `payment:${payment.id}`,
          kind: 'payment',

          date: payment.payment_date,
          createdAt: payment.created_at,

          documentNumber:
            payment.receipt_number ||
            payment.reference_number ||
            'Payment',

          relatedDocumentNumber:
            invoice?.invoice_number ??
            null,

          clientId: payment.client_id,
          caseId: payment.case_id,
          invoiceId: payment.invoice_id,
          paymentId: payment.id,

          description:
            payment.payment_method
              ? `${formatLabel(
                  payment.payment_method,
                )} payment`
              : 'Payment received',

          status: payment.status,

          amount:
            Number(
              payment.amount ?? 0,
            ),

          currency:
            payment.currency || 'AED',

          invoice,
          payment,
          creditNote: null,
          paymentReversal: null,
        };
      },
    ),

    ...creditNotes.map(
      (
        creditNote,
      ): FinancialLedgerEntry => {
        const invoice =
          invoiceMap.get(
            creditNote.invoice_id,
          ) ?? null;

        return {
          id:
            `credit-note:${creditNote.id}`,

          kind: 'credit_note',

          date: creditNote.issue_date,
          createdAt:
            creditNote.created_at,

          documentNumber:
            creditNote.credit_note_number,

          relatedDocumentNumber:
            invoice?.invoice_number ??
            null,

          clientId:
            creditNote.client_id,

          caseId:
            creditNote.case_id,

          invoiceId:
            creditNote.invoice_id,

          paymentId: null,

          description:
            creditNote.reason,

          status:
            creditNote.status,

          amount:
            Number(
              creditNote.total_amount ??
                0,
            ),

          currency:
            creditNote.currency || 'AED',

          invoice,
          payment: null,
          creditNote,
          paymentReversal: null,
        };
      },
    ),

    ...paymentReversals.map(
      (
        reversal,
      ): FinancialLedgerEntry => {
        const invoice =
          invoiceMap.get(
            reversal.invoice_id,
          ) ?? null;

        const payment =
          paymentMap.get(
            reversal.payment_id,
          ) ?? null;

        return {
          id:
            `payment-reversal:${reversal.id}`,

          kind: 'payment_reversal',

          date:
            reversal.reversal_date,

          createdAt:
            reversal.created_at,

          documentNumber:
            reversal.reversal_number,

          relatedDocumentNumber:
            payment?.receipt_number ||
            invoice?.invoice_number ||
            null,

          clientId:
            payment?.client_id ??
            invoice?.client_id ??
            null,

          caseId:
            payment?.case_id ??
            invoice?.case_id ??
            null,

          invoiceId:
            reversal.invoice_id,

          paymentId:
            reversal.payment_id,

          description:
            reversal.reason,

          status: 'issued',

          amount:
            Number(
              reversal.amount ?? 0,
            ),

          currency:
            reversal.currency || 'AED',

          invoice,
          payment,
          creditNote: null,
          paymentReversal: reversal,
        };
      },
    ),
    ...scopedFundReceiptEntries.map((receipt): FinancialLedgerEntry => ({
      id: `client-fund-receipt:${receipt.id}`,
      kind: 'client_fund_receipt',
      date: receipt.payment_date,
      createdAt: receipt.created_at,
      documentNumber: receipt.receipt_number,
      relatedDocumentNumber: receipt.reference_number,
      clientId: receipt.client_id,
      caseId: receipt.case_id,
      invoiceId: null,
      paymentId: null,
      description: receipt.notes || (receipt.payment_method ? `${formatLabel(receipt.payment_method)} client funds` : 'Client funds received'),
      status: receipt.status,
      amount: Number(receipt.amount),
      currency: receipt.currency || 'AED',
      invoice: null, payment: null, creditNote: null, paymentReversal: null,
    })),
    ...paymentAllocations.map((allocation): FinancialLedgerEntry => {
      const invoice = invoiceMap.get(allocation.invoice_id) ?? null;
      const receipt = receiptMap.get(allocation.receipt_id);
      return {
        id: `payment-allocation:${allocation.id}`,
        kind: 'payment_allocation',
        date: allocation.allocation_date,
        createdAt: allocation.created_at,
        documentNumber: receipt?.receipt_number || 'Funds allocation',
        relatedDocumentNumber: invoice?.invoice_number ?? null,
        clientId: invoice?.client_id ?? receipt?.client_id ?? null,
        caseId: invoice?.case_id ?? null,
        invoiceId: allocation.invoice_id,
        paymentId: null,
        description: allocation.notes || 'Client funds allocated to invoice',
        status: allocation.status,
        amount: Number(allocation.amount),
        currency: receipt?.currency || invoice?.currency || 'AED',
        invoice, payment: null, creditNote: null, paymentReversal: null,
      };
    }),
    ...paymentAllocationReversals.map((reversal): FinancialLedgerEntry => {
      const allocation = allocationMap.get(reversal.allocation_id);
      const invoice = allocation ? invoiceMap.get(allocation.invoice_id) ?? null : null;
      const receipt = allocation ? receiptMap.get(allocation.receipt_id) : undefined;
      return {
        id: `allocation-reversal:${reversal.id}`,
        kind: 'allocation_reversal',
        date: reversal.reversal_date,
        createdAt: reversal.created_at,
        documentNumber: 'Allocation reversal',
        relatedDocumentNumber: invoice?.invoice_number || receipt?.receipt_number || null,
        clientId: invoice?.client_id ?? receipt?.client_id ?? null,
        caseId: invoice?.case_id ?? null,
        invoiceId: invoice?.id ?? null,
        paymentId: null,
        description: reversal.reason,
        status: 'issued',
        amount: Number(reversal.amount),
        currency: receipt?.currency || invoice?.currency || 'AED',
        invoice, payment: null, creditNote: null, paymentReversal: null,
      };
    }),
    ...scopedFundReversalEntries.map((reversal): FinancialLedgerEntry => {
      const receipt = receiptMap.get(reversal.receipt_id);
      return {
        id: `client-fund-reversal:${reversal.id}`,
        kind: 'client_fund_reversal',
        date: reversal.reversal_date,
        createdAt: reversal.created_at,
        documentNumber: 'Client funds reversal',
        relatedDocumentNumber: receipt?.receipt_number || null,
        clientId: receipt?.client_id ?? null,
        caseId: receipt?.case_id ?? null,
        invoiceId: null,
        paymentId: null,
        description: reversal.reason,
        status: 'issued',
        amount: Number(reversal.amount),
        currency: receipt?.currency || 'AED',
        invoice: null, payment: null, creditNote: null, paymentReversal: null,
      };
    }),
  ].sort((left, right) => {
    const dateDifference =
      toTimestamp(right.date) -
      toTimestamp(left.date);

    if (dateDifference !== 0) {
      return dateDifference;
    }

    return (
      toTimestamp(right.createdAt) -
      toTimestamp(left.createdAt)
    );
  });

  const authoritativeSummary = calculateFinanceSummary(
    invoices,
    payments,
    creditNotes,
    paymentReversals,
  );
  const fundGross = scope.clientId
    ? clientFundReceipts.reduce((total, receipt) => total + Number(receipt.amount), 0)
    : paymentAllocations.reduce((total, allocation) => total + Number(allocation.amount), 0);
  const fundReversed = scope.clientId
    ? clientFundReversals.reduce((total, reversal) => total + Number(reversal.amount), 0)
    : paymentAllocationReversals.reduce((total, reversal) => total + Number(reversal.amount), 0);
  const {
    totalBilled,
    grossCollected: legacyGrossCollected,
    totalCredited,
    totalReversed: legacyTotalReversed,
    outstanding,
  } = authoritativeSummary;
  const grossCollected = legacyGrossCollected + fundGross;
  const totalReversed = legacyTotalReversed + fundReversed;
  const netCollected = Math.max(0, grossCollected - totalReversed);

  return {
    invoices,
    payments,
    creditNotes,
    paymentReversals,
    clientFundReceipts,
    paymentAllocations,
    paymentAllocationReversals,
    clientFundReversals,
    entries,

    summary: {
      invoiceCount:
        invoices.length,

      paymentCount:
        payments.length + clientFundReceipts.length,

      creditNoteCount:
        creditNotes.length,

      reversalCount:
        paymentReversals.length + clientFundReversals.length + paymentAllocationReversals.length,

      totalBilled,
      grossCollected,
      totalCredited,
      totalReversed,
      netCollected,
      outstanding,

      collectionRate:
        totalBilled > 0
          ? Math.min(
              100,
              Math.max(
                0,
                (
                  netCollected /
                  Math.max(
                    totalBilled -
                      totalCredited,
                    0.01,
                  )
                ) * 100,
              ),
            )
          : 0,
    },
  };
}

function toTimestamp(
  value?: string | null,
): number {
  if (!value) {
    return 0;
  }

  const timestamp =
    new Date(value).getTime();

  return Number.isNaN(timestamp)
    ? 0
    : timestamp;
}

function formatLabel(
  value: string,
): string {
  return value
    .replace(/_/g, ' ')
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase(),
    );
}
