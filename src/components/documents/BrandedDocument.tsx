import type { ReactNode } from 'react';

import { companyProfile } from '../../constants/companyProfile';
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
};

export function BrandedDocument({
  documentTitle,
  referenceNumber,
  recipientName,
  caseReference,
  meta,
  children,
  notes,
}: BrandedDocumentProps) {
  const contactDetails = [
    companyProfile.registeredAddress,
    companyProfile.email,
    companyProfile.phone,
  ].filter(Boolean);

  return (
    <article className="shab-document-print-root">
      <header className="shab-document-header">
        <div className="shab-document-brand">
          <img
            src={companyProfile.logoUrl}
            alt={companyProfile.legalName}
          />

          <div className="shab-document-company">
            <strong>{companyProfile.legalName}</strong>
            <span>{companyProfile.jurisdiction}</span>

            {companyProfile.taxRegistrationNumber ? (
              <span>
                TRN: {companyProfile.taxRegistrationNumber}
              </span>
            ) : null}
          </div>
        </div>

        <div className="shab-document-heading">
          <span>Billing Document</span>
          <h1>{documentTitle}</h1>
          <strong>{referenceNumber}</strong>
        </div>
      </header>

      <div className="shab-document-gold-rule" />

      <section className="shab-document-parties">
        <div className="shab-document-recipient">
          <span>Bill To</span>
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

      <section className="shab-document-payment-note">
        <strong>Payment Reference</strong>
        <p>
          Please quote {referenceNumber} when making payment
          or corresponding with SHAB regarding this invoice.
        </p>
      </section>

      <footer className="shab-document-footer">
        <div>
          <strong>{companyProfile.legalName}</strong>

          {contactDetails.length > 0 ? (
            contactDetails.map((detail) => (
              <span key={detail}>{detail}</span>
            ))
          ) : (
            <span>{companyProfile.jurisdiction}</span>
          )}
        </div>

        <span>
          This invoice was generated electronically through
          the SHAB practice management system.
        </span>
      </footer>
    </article>
  );
}
