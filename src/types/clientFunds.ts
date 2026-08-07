export type ClientFundReceiptStatus = 'completed' | 'partially_allocated' | 'allocated' | 'refunded';

export interface ClientFundReceipt {
  id: string;
  receipt_number: string;
  client_id: string;
  case_id: string | null;
  amount: number;
  allocated_amount: number;
  reversed_amount: number;
  currency: string;
  payment_date: string;
  payment_method: string | null;
  reference_number: string | null;
  status: ClientFundReceiptStatus;
  notes: string | null;
  received_by_staff_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentAllocation {
  id: string;
  receipt_id: string;
  invoice_id: string;
  amount: number;
  reversed_amount: number;
  status: 'active' | 'reversed';
  allocation_date: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface PaymentAllocationReversal {
  id: string;
  allocation_id: string;
  amount: number;
  reason: string;
  reversal_date: string;
  created_by: string | null;
  created_at: string;
}

export interface ClientFundReversal {
  id: string;
  receipt_id: string;
  amount: number;
  reason: string;
  reversal_date: string;
  created_by: string | null;
  created_at: string;
}

export type ClientFundReceiptWithAllocations = ClientFundReceipt & {
  allocations: PaymentAllocation[];
  available_amount: number;
};
