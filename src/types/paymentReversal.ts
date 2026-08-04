export interface PaymentReversal {
  id: string;
  reversal_number: string;

  payment_id: string;
  invoice_id: string;

  amount: number;
  currency: string;

  reversal_date: string;
  reason: string;

  created_by: string | null;
  created_at: string;
}

export type ReversePaymentInput = {
  payment_id: string;
  amount: number;
  reversal_date: string;
  reason: string;
};
