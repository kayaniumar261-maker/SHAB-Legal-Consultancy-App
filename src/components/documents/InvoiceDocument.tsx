import { createPortal } from 'react-dom';

import { companyProfile } from '../../constants/companyProfile';
import type { Invoice } from '../../types/invoice';
import type {
  CompanySettings,
} from '../../services/companySettingsService';
import { BrandedDocument } from './BrandedDocument';

type InvoiceDocumentProps = {
  invoice: Invoice;
  clientName: string;
  caseReference?: string | null;
  companySettings?: CompanySettings | null;
};

export function InvoicePrintPortal(
  props: InvoiceDocumentProps,
) {
  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div className="shab-document-print-portal">
      <InvoiceDocument {...props} />
    </div>,
    document.body,
  );
}

export function InvoiceDocument({
  invoice,
  clientName,
  caseReference,
  companySettings,
}: InvoiceDocumentProps) {
  const currency =
    invoice.currency ||
    companyProfile.defaultCurrency;

  const taxRegistrationNumber =
    companySettings?.tax_registration_number ||
    companyProfile.taxRegistrationNumber;

  const documentTitle =
    taxRegistrationNumber
      ? 'Tax Invoice'
      : 'Invoice';

  return (
    <BrandedDocument
      documentTitle={documentTitle}
      referenceNumber={invoice.invoice_number}
      recipientName={clientName}
      caseReference={caseReference}
      meta={[
        {
          label: 'Invoice Number',
          value: invoice.invoice_number,
        },
        {
          label: 'Issue Date',
          value: formatDocumentDate(
            invoice.issue_date,
          ),
        },
        {
          label: 'Due Date',
          value: formatDocumentDate(
            invoice.due_date,
          ),
        },
        {
          label: 'Status',
          value: formatDocumentLabel(
            invoice.status,
          ),
        },
      ]}
      notes={invoice.notes}
      companySettings={companySettings}
    >
      <section className="shab-invoice-services">
        <table>
          <thead>
            <tr>
              <th>Services</th>
              <th>Professional Fee</th>
            </tr>
          </thead>

          <tbody>
            <tr>
              <td>
                <strong>
                  {invoice.description ||
                    'Legal consultancy services'}
                </strong>

                {caseReference ? (
                  <p>
                    Services rendered in connection with
                    matter {caseReference}.
                  </p>
                ) : (
                  <p>
                    Professional legal consultancy and
                    related services.
                  </p>
                )}
              </td>

              <td>
                {formatDocumentCurrency(
                  invoice.subtotal,
                  currency,
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="shab-invoice-totals">
        <div>
          <span>Subtotal</span>
          <strong>
            {formatDocumentCurrency(
              invoice.subtotal,
              currency,
            )}
          </strong>
        </div>

        <div>
          <span>
            VAT ({formatRate(invoice.vat_rate)}%)
          </span>
          <strong>
            {formatDocumentCurrency(
              invoice.vat_amount,
              currency,
            )}
          </strong>
        </div>

        {Number(invoice.discount_amount ?? 0) > 0 ? (
          <div>
            <span>Discount</span>
            <strong>
              -{' '}
              {formatDocumentCurrency(
                invoice.discount_amount,
                currency,
              )}
            </strong>
          </div>
        ) : null}

        <div className="shab-invoice-total">
          <span>Invoice Total</span>
          <strong>
            {formatDocumentCurrency(
              invoice.total_amount,
              currency,
            )}
          </strong>
        </div>

        <div>
          <span>Amount Paid</span>
          <strong>
            {formatDocumentCurrency(
              invoice.paid_amount,
              currency,
            )}
          </strong>
        </div>

        <div className="shab-invoice-balance">
          <span>Amount Due</span>
          <strong>
            {formatDocumentCurrency(
              invoice.balance_amount,
              currency,
            )}
          </strong>
        </div>
      </section>

      {invoice.cancellation_reason ? (
        <section className="shab-invoice-cancellation">
          <span>Invoice Cancelled</span>

          <p>
            <strong>Reason:</strong>{' '}
            {invoice.cancellation_reason}
          </p>

          {invoice.cancelled_at ? (
            <p>
              <strong>Cancelled:</strong>{' '}
              {formatDocumentTimestamp(
                invoice.cancelled_at,
              )}
            </p>
          ) : null}
        </section>
      ) : null}
    </BrandedDocument>
  );
}

function formatDocumentCurrency(
  value: number | string | null | undefined,
  currency: string,
): string {
  const amount = Number(value ?? 0);

  return `${currency} ${new Intl.NumberFormat('en-AE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0)}`;
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

function formatDocumentTimestamp(
  value: string,
): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-AE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatDocumentLabel(value: string): string {
  return value
    .split('_')
    .map(
      (part) =>
        part.charAt(0).toUpperCase() +
        part.slice(1),
    )
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
