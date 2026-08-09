import { createPortal } from 'react-dom';

import { companyProfile } from '../../constants/companyProfile';
import type {
  CompanySettings,
} from '../../services/companySettingsService';
import type { CreditNote } from '../../types/creditNote';
import type { Invoice } from '../../types/invoice';
import { BrandedDocument } from './BrandedDocument';

type CreditNoteDocumentProps = {
  creditNote: CreditNote;
  invoice: Invoice;
  clientName: string;
  caseReference?: string | null;
  companySettings?: CompanySettings | null;
};

export function CreditNotePrintPortal(
  props: CreditNoteDocumentProps,
) {
  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div className="shab-document-print-portal">
      <CreditNoteDocument {...props} />
    </div>,
    document.body,
  );
}

export function CreditNoteDocument({
  creditNote,
  invoice,
  clientName,
  caseReference,
  companySettings,
}: CreditNoteDocumentProps) {
  const currency =
    creditNote.currency ||
    invoice.currency ||
    companyProfile.defaultCurrency;

  return (
    <BrandedDocument
      documentTitle={companySettings?.tax_registration_number && invoice.is_tax_invoice !== false ? 'Tax Credit Note' : 'Credit Note'}
      referenceNumber={
        creditNote.credit_note_number
      }
      recipientName={clientName}
      recipientLabel="Issued To"
      headingLabel="Invoice Adjustment"
      caseReference={caseReference}
      meta={[
        {
          label: 'Credit Note',
          value:
            creditNote.credit_note_number,
        },
        {
          label: 'Issue Date',
          value: formatDocumentDate(
            creditNote.issue_date,
          ),
        },
        {
          label: 'Tax Point Date',
          value: formatDocumentDate(creditNote.tax_point_date || creditNote.issue_date),
        },
        {
          label: 'VAT Treatment',
          value: formatDocumentLabel(creditNote.vat_treatment || invoice.vat_treatment || 'exclusive'),
        },
        {
          label: 'Original Invoice',
          value: invoice.invoice_number,
        },
        {
          label: 'Status',
          value: 'Issued',
        },
      ]}
      companySettings={companySettings}
      showBankDetails={false}
      referenceNoteTitle="Accounting Treatment"
      referenceNote={
        `This credit note reduces the amount payable under invoice ${invoice.invoice_number}. ` +
        'The original invoice remains permanently available in the financial history.'
      }
      footerText={
        'This credit note was generated electronically through the SHAB practice management system.'
      }
    >
      <section className="shab-adjustment-summary credit">
        <span>Total Credit</span>

        <strong>
          {formatDocumentCurrency(
            creditNote.total_amount,
            currency,
          )}
        </strong>

        <p>
          Credit issued against invoice{' '}
          {invoice.invoice_number}.
        </p>
      </section>

      <section className="shab-adjustment-breakdown">
        <dl>
          <div>
            <dt>Credit Subtotal</dt>
            <dd>
              {formatDocumentCurrency(
                creditNote.subtotal,
                currency,
              )}
            </dd>
          </div>

          <div>
            <dt>VAT Rate</dt>
            <dd>
              {formatRate(
                creditNote.vat_rate,
              )}%
            </dd>
          </div>

          <div>
            <dt>VAT Credit</dt>
            <dd>
              {formatDocumentCurrency(
                creditNote.vat_amount,
                currency,
              )}
            </dd>
          </div>

          <div>
            <dt>Original Invoice Total</dt>
            <dd>
              {formatDocumentCurrency(
                invoice.total_amount,
                currency,
              )}
            </dd>
          </div>
        </dl>
      </section>

      <section className="shab-adjustment-reason-box">
        <span>Reason for Credit</span>
        <p>{creditNote.reason}</p>
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

function formatDocumentLabel(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatRate(
  value: number | string | null | undefined,
): string {
  const rate = Number(value ?? 0);

  return Number.isFinite(rate)
    ? rate.toFixed(2)
    : '0.00';
}
