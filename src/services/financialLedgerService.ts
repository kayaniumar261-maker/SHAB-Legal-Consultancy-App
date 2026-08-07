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
  | 'payment_reversal';

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
  const {
    totalBilled,
    grossCollected,
    totalCredited,
    totalReversed,
    netCollected,
    outstanding,
  } = authoritativeSummary;

  return {
    invoices,
    payments,
    creditNotes,
    paymentReversals,
    entries,

    summary: {
      invoiceCount:
        invoices.length,

      paymentCount:
        payments.length,

      creditNoteCount:
        creditNotes.length,

      reversalCount:
        paymentReversals.length,

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
