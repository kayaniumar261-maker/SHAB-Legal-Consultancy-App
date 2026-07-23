export interface Payment {
  id: string;
  invoice_id: string;
  amount: number;
  method: string | null;
  status: 'completed' | 'failed' | 'pending';
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export type PaymentInsert = Omit<Payment, 'id' | 'created_at' | 'updated_at'>;
export type PaymentUpdate = Partial<PaymentInsert>;
