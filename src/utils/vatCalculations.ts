import type { VatTreatment } from '../types/vatAccounting';

export function calculateVatAmounts(input: {
  enteredAmount: number;
  vatRate: number;
  treatment: VatTreatment;
  discountAmount?: number;
}) {
  const amount = roundMoney(input.enteredAmount);
  const rate = input.treatment === 'zero_rated' || input.treatment === 'out_of_scope'
    ? 0
    : input.vatRate;
  const discount = roundMoney(input.discountAmount ?? 0);
  const subtotal = input.treatment === 'inclusive' && rate > 0
    ? roundMoney(amount / (1 + rate / 100))
    : amount;
  const vatAmount = input.treatment === 'inclusive'
    ? roundMoney(amount - subtotal)
    : roundMoney(subtotal * rate / 100);

  return {
    subtotal,
    vatRate: rate,
    vatAmount,
    totalAmount: roundMoney(subtotal + vatAmount - discount),
  };
}

export function invoiceEnteredAmount(
  subtotal: number,
  vatAmount: number,
  treatment?: VatTreatment,
) {
  return treatment === 'inclusive'
    ? roundMoney(subtotal + vatAmount)
    : roundMoney(subtotal);
}

function roundMoney(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}
