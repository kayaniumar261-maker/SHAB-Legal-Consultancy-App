import type {
  PostgrestError,
} from '@supabase/supabase-js';

import { supabase } from '../lib/supabase';

import type {
  CreditNote,
  IssueCreditNoteInput,
} from '../types/creditNote';

import type {
  PaymentReversal,
  ReversePaymentInput,
} from '../types/paymentReversal';

function handleError<T>(result: {
  error: PostgrestError | null;
  data: T | null;
}): T {
  if (result.error) {
    throw new Error(result.error.message);
  }

  if (result.data === null) {
    throw new Error(
      'No data returned from Supabase.',
    );
  }

  return result.data;
}

export async function getCreditNotes(
  invoiceId?: string,
): Promise<CreditNote[]> {
  let query = supabase
    .from('credit_notes')
    .select('*')
    .order('issue_date', {
      ascending: false,
    })
    .order('created_at', {
      ascending: false,
    });

  if (invoiceId) {
    query = query.eq(
      'invoice_id',
      invoiceId,
    );
  }

  const result = await query;

  return handleError(
    result,
  ) as CreditNote[];
}

export async function issueCreditNote(
  input: IssueCreditNoteInput,
): Promise<CreditNote> {
  const result = await supabase.rpc(
    'shab_issue_credit_note',
    {
      p_invoice_id: input.invoice_id,
      p_subtotal: input.subtotal,
      p_vat_rate: input.vat_rate,
      p_issue_date: input.issue_date,
      p_reason: input.reason,
    },
  );

  return handleError(
    result,
  ) as CreditNote;
}

export async function getPaymentReversals(
  paymentId?: string,
): Promise<PaymentReversal[]> {
  let query = supabase
    .from('payment_reversals')
    .select('*')
    .order('reversal_date', {
      ascending: false,
    })
    .order('created_at', {
      ascending: false,
    });

  if (paymentId) {
    query = query.eq(
      'payment_id',
      paymentId,
    );
  }

  const result = await query;

  return handleError(
    result,
  ) as PaymentReversal[];
}

export async function reversePayment(
  input: ReversePaymentInput,
): Promise<PaymentReversal> {
  const result = await supabase.rpc(
    'shab_reverse_payment',
    {
      p_payment_id: input.payment_id,
      p_amount: input.amount,
      p_reversal_date:
        input.reversal_date,
      p_reason: input.reason,
    },
  );

  return handleError(
    result,
  ) as PaymentReversal;
}
