import { createPortal } from 'react-dom';

import { companyProfile } from '../../constants/companyProfile';
import type {
  CompanySettings,
} from '../../services/companySettingsService';
import type { Invoice } from '../../types/invoice';
import type { Payment } from '../../types/payment';
import { BrandedDocument } from './BrandedDocument';

type PaymentReceiptDocumentProps = {
  payment: Payment;
  invoice: Invoice;
  clientName: string;
  caseReference?: string | null;
  companySettings?: CompanySettings | null;
};

export function PaymentReceiptPrintPortal(
  props: PaymentReceiptDocumentProps,
) {
  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div className="shab-document-print-portal">
      <PaymentReceiptDocument {...props} />
    </div>,
    document.body,
  );
}

export function PaymentReceiptDocument({
  payment,
  invoice,
  clientName,
  caseReference,
  companySettings,
}: PaymentReceiptDocumentProps) {
  const currency =
    payment.currency ||
    invoice.currency ||
    companyProfile.defaultCurrency;

  const receiptNumber =
    payment.receipt_number ||
    'Receipt pending';

  return (
    <BrandedDocument
      documentTitle="Payment Receipt"
      referenceNumber={receiptNumber}
      recipientName={clientName}
      recipientLabel="Received From"
      headingLabel="Official Receipt"
      caseReference={caseReference}
      meta={[
        {
          label: 'Receipt Number',
          value: receiptNumber,
        },
        {
          label: 'Payment Date',
          value: formatDocumentDate(
            payment.payment_date,
          ),
        },
        {
          label: 'Invoice Number',
          value: invoice.invoice_number,
        },
        {
          label: 'Status',
          value: formatDocumentLabel(
            payment.status,
          ),
        },
      ]}
      notes={payment.notes}
      companySettings={companySettings}
      showBankDetails={false}
      referenceNoteTitle="Receipt Information"
      referenceNote={
        `Payment received against invoice ${invoice.invoice_number}. ` +
        'Please retain this receipt for your records.'
      }
      footerText={
        'This payment receipt was generated electronically through the SHAB practice management system.'
      }
    >
      <section className="shab-receipt-summary">
        <span>Amount Received</span>

        <strong>
          {formatDocumentCurrency(
            payment.amount,
            currency,
          )}
        </strong>

        <p>
          Received from {clientName} toward invoice{' '}
          {invoice.invoice_number}.
        </p>
      </section>

      <section className="shab-receipt-details">
        <dl>
          <div>
            <dt>Payment Method</dt>
            <dd>
              {payment.payment_method ||
                'Not specified'}
            </dd>
          </div>

          <div>
            <dt>Transaction Reference</dt>
            <dd>
              {payment.reference_number ||
                'Not provided'}
            </dd>
          </div>

          <div>
            <dt>Invoice Total</dt>
            <dd>
              {formatDocumentCurrency(
                invoice.total_amount,
                currency,
              )}
            </dd>
          </div>

          <div>
            <dt>Current Invoice Balance</dt>
            <dd>
              {formatDocumentCurrency(
                invoice.balance_amount,
                currency,
              )}
            </dd>
          </div>
        </dl>
      </section>
    </BrandedDocument>
  );
}

function formatDocumentCurrency(
  value: number | string | null | undefined,
  currency: string,
): string {
  const amount = Number(value ?? 0);

  return `${currency} ${new Intl.NumberFormat(
    'en-AE',
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  ).format(Number.isFinite(amount) ? amount : 0)}`;
}

function formatDocumentDate(
  value: string | null | undefined,
): string {
  if (!value) {
    return 'Not specified';
  }

  const date = new Date(
    `${value.slice(0, 10)}T00:00:00`,
  );

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatDocumentLabel(
  value: string,
): string {
  return value
    .split('_')
    .map(
      (part) =>
        part.charAt(0).toUpperCase() +
        part.slice(1),
    )
    .join(' ');
}
