export type FeeBillingModel =
  | 'fixed'
  | 'installments'
  | 'milestones'
  | 'hourly'
  | 'retainer'
  | 'success_fee'
  | 'mixed';

export type FeeAgreementStatus =
  | 'draft'
  | 'active'
  | 'completed'
  | 'expired'
  | 'cancelled';

export type FeeInstallmentStatus =
  | 'planned'
  | 'ready'
  | 'invoiced'
  | 'paid'
  | 'waived'
  | 'cancelled';

export interface FeeAgreement {
  id: string;
  agreement_number: string;
  client_id: string;
  case_id: string | null;
  title: string;
  billing_model: FeeBillingModel;
  status: FeeAgreementStatus;
  currency: string;
  agreed_fee: number;
  vat_rate: number;
  hourly_rate: number | null;
  success_fee_percentage: number | null;
  agreement_date: string;
  valid_from: string | null;
  valid_until: string | null;
  notes: string | null;
  cancellation_reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface FeeInstallment {
  id: string;
  agreement_id: string;
  sequence_number: number;
  title: string;
  description: string | null;
  milestone: string | null;
  planned_subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total_amount: number;
  due_date: string | null;
  status: FeeInstallmentStatus;
  invoice_id: string | null;
  ready_at: string | null;
  invoiced_at: string | null;
  paid_at: string | null;
  waived_at: string | null;
  cancelled_at: string | null;
  status_reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type FeeAgreementWithInstallments = FeeAgreement & {
  installments: FeeInstallment[];
};

export type FeeAgreementSummary = {
  agreedFee: number;
  plannedSubtotal: number;
  plannedTotal: number;
  invoicedTotal: number;
  paidTotal: number;
  waivedTotal: number;
  cancelledTotal: number;
  unplannedBalance: number;
  nextInstallment: FeeInstallment | null;
  overdueInstallments: FeeInstallment[];
};

export type FeeAgreementInsert = Pick<
  FeeAgreement,
  | 'client_id'
  | 'case_id'
  | 'title'
  | 'billing_model'
  | 'currency'
  | 'agreed_fee'
  | 'vat_rate'
  | 'hourly_rate'
  | 'success_fee_percentage'
  | 'agreement_date'
  | 'valid_from'
  | 'valid_until'
  | 'notes'
> & {
  status?: FeeAgreementStatus;
};

export type FeeAgreementUpdate = Partial<
  Omit<FeeAgreementInsert, 'client_id' | 'case_id'>
>;

export type FeeInstallmentInsert = Pick<
  FeeInstallment,
  | 'agreement_id'
  | 'title'
  | 'description'
  | 'milestone'
  | 'planned_subtotal'
  | 'vat_rate'
  | 'due_date'
> & {
  sequence_number?: number;
  status?: Extract<FeeInstallmentStatus, 'planned' | 'ready'>;
};

export type FeeInstallmentUpdate = Partial<
  Omit<FeeInstallmentInsert, 'agreement_id' | 'status'>
> & {
  status_reason?: string | null;
};
