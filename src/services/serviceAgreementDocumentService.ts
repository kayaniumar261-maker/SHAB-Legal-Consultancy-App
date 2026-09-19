import { getClientById } from './clientService';
import { getCompanySettings } from './companySettingsService';
import { uploadDocument } from './documentService';
import { updateFeeAgreement } from './feeAgreementService';
import type { FeeAgreementWithInstallments } from '../types/feeAgreement';

type AgreementDocumentContext = {
  agreement: FeeAgreementWithInstallments;
  caseReference?: string | null;
};

export async function generateAndFileServiceAgreement({
  agreement,
  caseReference,
}: AgreementDocumentContext) {
  const [client, company] = await Promise.all([
    getClientById(agreement.client_id),
    getCompanySettings(),
  ]);

  if (!client) {
    throw new Error('The agreement client could not be found.');
  }

  const nextVersion = Number(agreement.agreement_document_version ?? 0) + 1;
  const filename = `${agreement.agreement_number}-Service-Agreement-v${nextVersion}.html`;
  const html = buildServiceAgreementHtml({
    agreement,
    caseReference,
    client: {
      name: client.company_name || client.full_name,
      contactName: client.company_name ? client.full_name : null,
      email: client.email,
      phone: client.phone,
      address: client.address,
    },
    company: {
      name: company?.legal_name || 'SHAB Advocates & Legal Consultations',
      address: company?.registered_address || 'Dubai, United Arab Emirates',
      email: company?.email || null,
      phone: company?.phone || null,
    },
  });

  const file = new File([html], filename, {
    type: 'text/html;charset=utf-8',
  });

  const document = await uploadDocument({
    file,
    name: filename,
    document_type: 'Service Agreement',
    case_id: agreement.case_id,
    client_id: agreement.client_id,
    is_confidential: true,
    description: `${agreement.agreement_number} · ${agreement.service_category || agreement.title} · generated version ${nextVersion}`,
  });

  const generatedAt = new Date().toISOString();
  await updateFeeAgreement(agreement.id, {
    agreement_document_id: document.id,
    agreement_document_version: nextVersion,
    document_status: 'generated',
    generated_at: generatedAt,
  });

  return document;
}

function buildServiceAgreementHtml(input: {
  agreement: FeeAgreementWithInstallments;
  caseReference?: string | null;
  client: {
    name: string;
    contactName: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
  };
  company: {
    name: string;
    address: string;
    email: string | null;
    phone: string | null;
  };
}) {
  const { agreement, client, company, caseReference } = input;
  const scope = agreement.scope_items.length
    ? agreement.scope_items
    : [agreement.title];
  const rows = agreement.installments.map((item) => `
    <tr>
      <td>${escapeHtml(item.title)}</td>
      <td>${escapeHtml(item.milestone || item.description || 'As agreed')}</td>
      <td>${formatMoney(Number(item.planned_subtotal), agreement.currency)}</td>
      <td>${Number(item.vat_rate).toFixed(2)}%</td>
    </tr>`).join('');
  const successFee = agreement.success_fee_percentage
    ? `<p><strong>Success fee:</strong> ${Number(agreement.success_fee_percentage).toFixed(2)}% upon recovery or successful outcome, as applicable.</p>`
    : '';

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(agreement.agreement_number)} Service Agreement</title>
<style>
@page{size:A4;margin:18mm}body{font-family:Arial,sans-serif;color:#172033;font-size:11pt;line-height:1.5;max-width:820px;margin:0 auto}header{display:flex;justify-content:space-between;gap:24px;border-bottom:3px solid #b38a38;padding-bottom:18px;margin-bottom:24px}h1{font-size:24px;margin:0}h2{font-size:15px;margin:24px 0 8px}p{margin:7px 0}.muted{color:#5b6472}.ref{text-align:right}table{width:100%;border-collapse:collapse;margin:12px 0}th,td{border:1px solid #d7dbe2;padding:9px;text-align:left;vertical-align:top}th{background:#172033;color:white}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:48px;margin-top:54px}.line{border-top:1px solid #172033;padding-top:8px}.footer{margin-top:40px;padding-top:12px;border-top:1px solid #d7dbe2;font-size:9pt;color:#5b6472}@media print{body{max-width:none}}
</style></head><body>
<header><div><strong>${escapeHtml(company.name)}</strong><div class="muted">${escapeHtml(company.address)}</div><div class="muted">${escapeHtml([company.email, company.phone].filter(Boolean).join(' · '))}</div></div><div class="ref"><h1>Service Agreement</h1><strong>${escapeHtml(agreement.agreement_number)}</strong><div>${formatDate(agreement.agreement_date)}</div></div></header>
<p>This Service Agreement is entered into between <strong>${escapeHtml(company.name)}</strong> (the “First Party”) and <strong>${escapeHtml(client.name)}</strong> (the “Second Party”).</p>
<h2>Client and Matter</h2>
<p>${client.contactName ? `<strong>Contact:</strong> ${escapeHtml(client.contactName)}<br>` : ''}<strong>Contact details:</strong> ${escapeHtml([client.phone, client.email].filter(Boolean).join(' · ') || 'Not provided')}${client.address ? `<br><strong>Address:</strong> ${escapeHtml(client.address)}` : ''}${caseReference ? `<br><strong>Matter reference:</strong> ${escapeHtml(caseReference)}` : ''}</p>
<h2>Services</h2>
<p><strong>Category:</strong> ${escapeHtml(agreement.service_category || 'Legal Services')}<br><strong>Service:</strong> ${escapeHtml(agreement.service_subcategory || agreement.title)}</p>
<ul>${scope.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
<h2>Professional Fees</h2>
${rows ? `<table><thead><tr><th>Fee stage</th><th>Trigger or milestone</th><th>Amount</th><th>VAT</th></tr></thead><tbody>${rows}</tbody></table>` : `<p>Agreed professional fee: <strong>${formatMoney(Number(agreement.agreed_fee), agreement.currency)}</strong>, exclusive of applicable VAT.</p>`}
${successFee}
<h2>Expenses</h2><p>Professional fees exclude court, judicial, expert, translation, administrative and other third-party charges. The Second Party shall reimburse approved direct costs and government or judicial fees incurred for the matter. Receipts will be provided where issued by the relevant authority or supplier.</p>
<h2>Payment</h2><p>Invoices are payable within ${agreement.payment_terms_days} day${agreement.payment_terms_days === 1 ? '' : 's'} from the invoice date. Delay in payment may delay or suspend work. Professional fees paid after execution of this agreement are non-refundable, subject to applicable law and any written agreement between the parties.</p>
<h2>Confidentiality</h2><p>Written and oral information supplied by the Second Party in connection with this engagement will be treated as confidential, subject to professional duties, applicable law, regulatory obligations and disclosures required to perform the agreed services.</p>
<h2>Performance of Services</h2><p>The First Party will perform the agreed scope with reasonable professional care and in accordance with applicable professional obligations. No particular result, judgment, recovery or outcome is guaranteed.</p>
<h2>Termination</h2><p>Either party may terminate this agreement following a material breach that is not remedied within fourteen days after written notice. Fees, approved costs and liabilities accrued before termination remain payable.</p>
<h2>Dispute Resolution and Jurisdiction</h2><p>Any dispute arising out of or in connection with this agreement shall be resolved by arbitration under the Rules of the Dubai International Arbitration Centre by one or more arbitrators appointed in accordance with those Rules, unless the parties agree otherwise in writing.</p>
<div class="signatures"><div class="line"><strong>FIRST PARTY</strong><br>${escapeHtml(company.name)}<br>Name and signature:<br>Date:</div><div class="line"><strong>SECOND PARTY</strong><br>${escapeHtml(client.name)}<br>Signatory: ${escapeHtml(agreement.client_signatory_name || '')}<br>Title: ${escapeHtml(agreement.client_signatory_title || '')}<br>Date:</div></div>
<div class="footer">Generated by the SHAB practice management system · Terms version ${escapeHtml(agreement.standard_terms_version)}</div>
</body></html>`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character] || character);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'long' }).format(new Date(`${value}T00:00:00`));
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat('en-AE', { style: 'currency', currency }).format(value);
}
