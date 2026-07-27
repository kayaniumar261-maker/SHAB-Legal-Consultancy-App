export type PaymentStatus = 'completed' | 'failed' | 'pending';

export interface Payment {
  id: string;
  invoice_id: string;
  client_id: string;
  case_id: string | null;

  amount: number;
  currency: string;

  payment_date: string;
  payment_method: string | null;
  reference_number: string | null;

  status: PaymentStatus;
  notes: string | null;

  received_by_staff_id: string | null;
  created_by: string | null;

  created_at: string;
  updated_at: string;
  paid_at: string | null;
}

export type PaymentInsert = Omit<
  Payment,
  'id' | 'created_at' | 'updated_at'
>;

export type PaymentUpdate = Partial<PaymentInsert>;