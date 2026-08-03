import type { ReactNode } from 'react';

import { companyProfile } from '../../constants/companyProfile';
import type {
  CompanySettings,
} from '../../services/companySettingsService';
import './BrandedDocument.css';

type DocumentMetaItem = {
  label: string;
  value: string;
};

type BrandedDocumentProps = {
  documentTitle: string;
  referenceNumber: string;
  recipientName: string;
  caseReference?: string | null;
  meta: DocumentMetaItem[];
  children: ReactNode;
  notes?: string | null;
  companySettings?: CompanySettings | null;
  headingLabel?: string;
  recipientLabel?: string;
  showBankDetails?: boolean;
  referenceNoteTitle?: string;
  referenceNote?: string | null;
  footerText?: string;
};

export function BrandedDocument({
  documentTitle,
  referenceNumber,
  recipientName,
  caseReference,
  meta,
  children,
  notes,
  companySettings,
  headingLabel = 'Billing Document',
  recipientLabel = 'Bill To',
  showBankDetails = true,
  referenceNoteTitle = 'Payment Reference',
  referenceNote,
  footerText =
    'This invoice was generated electronically through the SHAB practice management system.',
}: BrandedDocumentProps) {
  const legalName =
    companySettings?.legal_name ||
    companyProfile.legalName;

  const registeredAddress =
    companySettings?.registered_address ||
    companyProfile.registeredAddress;

  const email =
    companySettings?.email ||
    companyProfile.email;

  const phone =
    companySettings?.phone ||
    companyProfile.phone;

  const taxRegistrationNumber =
    companySettings?.tax_registration_number ||
    companyProfile.taxRegistrationNumber;

  const contactDetails = [
    registeredAddress,
    email,
    phone,
  ].filter(Boolean) as string[];

  const paymentDetails = [
    {
      label: 'Beneficiary',
      value: companySettings?.account_holder_name,
    },
    {
      label: 'Bank',
      value: companySettings?.bank_name,
    },
    {
      label: 'Account Number',
      value: companySettings?.account_number,
    },
    {
      label: 'IBAN',
      value: companySettings?.iban,
    },
    {
      label: 'SWIFT / BIC',
      value: companySettings?.swift_bic,
    },
    {
      label: 'Routing Code',
      value: companySettings?.routing_code,
    },
    {
      label: 'Currency',
      value: companySettings?.account_currency,
    },
  ].filter(
    (item): item is {
      label: string;
      value: string;
    } => Boolean(item.value),
  );

  return (
    <article className="shab-document-print-root">
      <header className="shab-document-header">
        <div className="shab-document-brand">
          <img
            src={companyProfile.logoUrl}
            alt={legalName}
          />

          <div className="shab-document-company">
            <strong>{legalName}</strong>
            <span>{companyProfile.jurisdiction}</span>

            {taxRegistrationNumber ? (
              <span>
                TRN: {taxRegistrationNumber}
              </span>
            ) : null}
          </div>
        </div>

        <div className="shab-document-heading">
          <span>{headingLabel}</span>
          <h1>{documentTitle}</h1>
          <strong>{referenceNumber}</strong>
        </div>
      </header>

      <div className="shab-document-gold-rule" />

      <section className="shab-document-parties">
        <div className="shab-document-recipient">
          <span>{recipientLabel}</span>
          <strong>{recipientName}</strong>

          {caseReference ? (
            <p>
              Matter reference: {caseReference}
            </p>
          ) : null}
        </div>

        <dl className="shab-document-meta">
          {meta.map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <main className="shab-document-body">
        {children}
      </main>

      {notes ? (
        <section className="shab-document-notes">
          <span>Additional Notes</span>
          <p>{notes}</p>
        </section>
      ) : null}

      {showBankDetails &&
      paymentDetails.length > 0 ? (
        <section className="shab-document-bank-details">
          <div className="shab-document-section-heading">
            <span>Payment Details</span>
            <strong>Bank Transfer</strong>
          </div>

          <dl>
            {paymentDetails.map((item) => (
              <div key={item.label}>
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>

          {companySettings?.payment_instructions ? (
            <p>
              {companySettings.payment_instructions}
            </p>
          ) : null}
        </section>
      ) : null}

      {referenceNote !== null ? (
        <section className="shab-document-payment-note">
          <strong>{referenceNoteTitle}</strong>
          <p>
            {referenceNote ??
              `Please quote ${referenceNumber} when making payment or corresponding with SHAB regarding this invoice.`}
          </p>
        </section>
      ) : null}

      <footer className="shab-document-footer">
        <div>
          <strong>{legalName}</strong>

          {contactDetails.length > 0 ? (
            contactDetails.map((detail) => (
              <span key={detail}>{detail}</span>
            ))
          ) : (
            <span>{companyProfile.jurisdiction}</span>
          )}
        </div>

        <span>{footerText}</span>
      </footer>
    </article>
  );
}
