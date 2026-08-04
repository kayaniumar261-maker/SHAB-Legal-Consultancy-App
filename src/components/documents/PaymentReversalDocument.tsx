import { createPortal } from 'react-dom';

import { companyProfile } from '../../constants/companyProfile';
import type {
  CompanySettings,
} from '../../services/companySettingsService';
import type { Invoice } from '../../types/invoice';
import type { Payment } from '../../types/payment';
import type {
  PaymentReversal,
} from '../../types/paymentReversal';
import { BrandedDocument } from './BrandedDocument';

type PaymentReversalDocumentProps = {
  reversal: PaymentReversal;
  payment: Payment;
  invoice: Invoice;
  clientName: string;
  caseReference?: string | null;
  companySettings?: CompanySettings | null;
};

export function PaymentReversalPrintPortal(
  props: PaymentReversalDocumentProps,
) {
  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div className="shab-document-print-portal">
      <PaymentReversalDocument {...props} />
    </div>,
    document.body,
  );
}

export function PaymentReversalDocument({
  reversal,
  payment,
  invoice,
  clientName,
  caseReference,
  companySettings,
}: PaymentReversalDocumentProps) {
  const currency =
    reversal.currency ||
    payment.currency ||
    invoice.currency ||
    companyProfile.defaultCurrency;

  return (
    <BrandedDocument
      documentTitle="Payment Reversal"
      referenceNumber={
        reversal.reversal_number
      }
      recipientName={clientName}
      recipientLabel="Account Holder"
      headingLabel="Payment Correction"
      caseReference={caseReference}
      meta={[
        {
          label: 'Reversal Number',
          value:
            reversal.reversal_number,
        },
        {
          label: 'Reversal Date',
          value: formatDocumentDate(
            reversal.reversal_date,
          ),
        },
        {
          label: 'Original Receipt',
          value:
            payment.receipt_number ||
            'Not available',
        },
        {
          label: 'Invoice Number',
          value: invoice.invoice_number,
        },
      ]}
      companySettings={companySettings}
      showBankDetails={false}
      referenceNoteTitle="Audit Information"
      referenceNote={
        'The original payment and receipt remain permanently available. ' +
        'This document records the authorized financial reversal without deleting historical records.'
      }
      footerText={
        'This payment reversal was generated electronically through the SHAB practice management system.'
      }
    >
      <section className="shab-adjustment-summary reversal">
        <span>Amount Reversed</span>

        <strong>
          {formatDocumentCurrency(
            reversal.amount,
            currency,
          )}
        </strong>

        <p>
          Reversal recorded against receipt{' '}
          {payment.receipt_number ||
            payment.id.slice(0, 8)}.
        </p>
      </section>

      <section className="shab-adjustment-breakdown">
        <dl>
          <div>
            <dt>Original Payment</dt>
            <dd>
              {formatDocumentCurrency(
                payment.amount,
                currency,
              )}
            </dd>
          </div>

          <div>
            <dt>Total Reversed</dt>
            <dd>
              {formatDocumentCurrency(
                payment.reversed_amount,
                currency,
              )}
            </dd>
          </div>

          <div>
            <dt>Payment Date</dt>
            <dd>
              {formatDocumentDate(
                payment.payment_date,
              )}
            </dd>
          </div>

          <div>
            <dt>Payment Method</dt>
            <dd>
              {payment.payment_method ||
                'Not specified'}
            </dd>
          </div>
        </dl>
      </section>

      <section className="shab-adjustment-reason-box">
        <span>Reason for Reversal</span>
        <p>{reversal.reason}</p>
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
  value: string,
): string {
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
