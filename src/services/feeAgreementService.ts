import type { PostgrestError } from '@supabase/supabase-js';

import { supabase } from '../lib/supabase';
import type {
  FeeAgreement,
  FeeAgreementInsert,
  FeeAgreementUpdate,
  FeeAgreementWithInstallments,
  FeeAgreementSummary,
  FeeInstallment,
  FeeInstallmentInsert,
  FeeInstallmentStatus,
  FeeInstallmentUpdate,
} from '../types/feeAgreement';
import type { Invoice } from '../types/invoice';

function unwrap<T>(result: {
  data: T | null;
  error: PostgrestError | null;
}): T {
  if (result.error) {
    throw new Error(result.error.message);
  }

  if (result.data === null) {
    throw new Error('No data returned from Supabase.');
  }

  return result.data;
}

export async function getFeeAgreements(options: {
  clientId?: string;
  caseId?: string;
} = {}): Promise<FeeAgreementWithInstallments[]> {
  let query = supabase
    .from('fee_agreements')
    .select('*, installments:fee_installments(*)')
    .order('agreement_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (options.clientId) {
    query = query.eq('client_id', options.clientId);
  }

  if (options.caseId) {
    query = query.eq('case_id', options.caseId);
  }

  const rows = unwrap(await query) as FeeAgreementWithInstallments[];

  return rows.map((agreement) => ({
    ...agreement,
    installments: [...(agreement.installments ?? [])].sort(
      (left, right) => left.sequence_number - right.sequence_number,
    ),
  }));
}

export async function createFeeAgreement(
  data: FeeAgreementInsert,
): Promise<FeeAgreement> {
  return unwrap(
    await supabase
      .from('fee_agreements')
      .insert(data)
      .select()
      .single(),
  ) as FeeAgreement;
}

export async function updateFeeAgreement(
  id: string,
  data: FeeAgreementUpdate,
): Promise<FeeAgreement> {
  return unwrap(
    await supabase
      .from('fee_agreements')
      .update(data)
      .eq('id', id)
      .select()
      .single(),
  ) as FeeAgreement;
}

export async function createFeeInstallment(
  data: FeeInstallmentInsert,
): Promise<FeeInstallment> {
  return unwrap(
    await supabase
      .from('fee_installments')
      .insert(data)
      .select()
      .single(),
  ) as FeeInstallment;
}

export async function updateFeeInstallment(
  id: string,
  data: FeeInstallmentUpdate,
): Promise<FeeInstallment> {
  return unwrap(
    await supabase
      .from('fee_installments')
      .update(data)
      .eq('id', id)
      .select()
      .single(),
  ) as FeeInstallment;
}

export async function changeFeeInstallmentStatus(
  id: string,
  status: FeeInstallmentStatus,
  reason?: string,
): Promise<FeeInstallment> {
  return unwrap(
    await supabase.rpc('shab_change_fee_installment_status', {
      p_installment_id: id,
      p_status: status,
      p_reason: reason ?? null,
    }),
  ) as FeeInstallment;
}

export async function generateInvoiceFromInstallment(
  installmentId: string,
  issueDate: string,
): Promise<Invoice> {
  return unwrap(
    await supabase.rpc('shab_invoice_fee_installment', {
      p_installment_id: installmentId,
      p_issue_date: issueDate,
    }),
  ) as Invoice;
}

export function summarizeFeeAgreement(
  agreement: FeeAgreementWithInstallments,
  today = new Date(),
): FeeAgreementSummary {
  const activeInstallments = agreement.installments.filter(
    (installment) => installment.status !== 'cancelled',
  );
  const billableInstallments = activeInstallments.filter(
    (installment) => installment.status !== 'waived',
  );
  const openInstallments = billableInstallments
    .filter((installment) =>
      ['planned', 'ready', 'invoiced'].includes(installment.status),
    )
    .sort(compareInstallmentDueDate);
  const todayValue = new Date(today);

  todayValue.setHours(0, 0, 0, 0);

  return {
    agreedFee: Number(agreement.agreed_fee ?? 0),
    plannedSubtotal: sum(
      billableInstallments.map((installment) => installment.planned_subtotal),
    ),
    plannedTotal: sum(
      billableInstallments.map((installment) => installment.total_amount),
    ),
    invoicedTotal: sum(
      agreement.installments
        .filter((installment) =>
          ['invoiced', 'paid'].includes(installment.status),
        )
        .map((installment) => installment.total_amount),
    ),
    paidTotal: sum(
      agreement.installments
        .filter((installment) => installment.status === 'paid')
        .map((installment) => installment.total_amount),
    ),
    waivedTotal: sum(
      agreement.installments
        .filter((installment) => installment.status === 'waived')
        .map((installment) => installment.total_amount),
    ),
    cancelledTotal: sum(
      agreement.installments
        .filter((installment) => installment.status === 'cancelled')
        .map((installment) => installment.total_amount),
    ),
    unplannedBalance: Math.max(
      0,
      Number(agreement.agreed_fee ?? 0) -
        sum(billableInstallments.map((installment) => installment.planned_subtotal)),
    ),
    nextInstallment: openInstallments[0] ?? null,
    overdueInstallments: openInstallments.filter((installment) => {
      if (!installment.due_date) {
        return false;
      }

      const dueDate = new Date(`${installment.due_date}T00:00:00`);

      return !Number.isNaN(dueDate.getTime()) && dueDate < todayValue;
    }),
  };
}

function compareInstallmentDueDate(
  left: FeeInstallment,
  right: FeeInstallment,
): number {
  if (!left.due_date && !right.due_date) {
    return left.sequence_number - right.sequence_number;
  }

  if (!left.due_date) {
    return 1;
  }

  if (!right.due_date) {
    return -1;
  }

  return left.due_date.localeCompare(right.due_date) ||
    left.sequence_number - right.sequence_number;
}

function sum(values: Array<number | string | null | undefined>): number {
  return values.reduce<number>(
    (total, value) => total + Number(value ?? 0),
    0,
  );
}
