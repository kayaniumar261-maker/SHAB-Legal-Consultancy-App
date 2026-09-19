import { getClientById } from './clientService';
import { getCompanySettings } from './companySettingsService';
import { uploadDocument } from './documentService';
import { updateFeeAgreement } from './feeAgreementService';
import type { FeeAgreementWithInstallments } from '../types/feeAgreement';
import { shabLogoUrl } from '../constants/branding';

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

export function buildServiceAgreementHtml(input: {
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
  const feeLines = agreement.installments.map((item) => `
    <div class="fee-line"><strong>${escapeHtml(item.title)}</strong><span>${formatMoney(Number(item.planned_subtotal), agreement.currency)} + ${Number(item.vat_rate).toFixed(2)}% VAT</span></div>
    <div class="fee-note">${escapeHtml(item.milestone || item.description || 'As agreed')}</div>`).join('');
  const successFee = agreement.success_fee_percentage
    ? `<p><strong>Success fee:</strong> ${Number(agreement.success_fee_percentage).toFixed(2)}% upon recovery or successful outcome, as applicable.</p>`
    : '';

  const logoUrl = new URL(shabLogoUrl, window.location.href).href;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(agreement.agreement_number)} Service Agreement</title>
<style>
@page{size:A4;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#d7d9dd;color:#111}body{font-family:"Times New Roman",Times,serif;font-size:10.5pt;line-height:1.28}.page{position:relative;width:210mm;min-height:297mm;margin:10mm auto;padding:43mm 25mm 33mm;background:#fff;overflow:hidden;page-break-after:always}.page:last-child{page-break-after:auto}.brand-header{position:absolute;inset:0 0 auto;height:34mm;background:#070707;border-top:1mm solid #070707}.brand-header:after{content:"";position:absolute;right:0;top:3mm;width:77mm;height:12mm;background:#dfa91a;border:2mm solid #fff;transform:skewX(37deg);transform-origin:right top}.brand-logo{position:absolute;z-index:2;left:7mm;top:1mm;width:72mm;height:31mm;display:grid;place-items:center;background:#090909;clip-path:polygon(0 0,83% 0,100% 50%,83% 100%,0 100%)}.brand-logo img{width:48mm;height:27mm;object-fit:contain}.watermark{position:absolute;z-index:0;left:50%;top:50%;width:78mm;opacity:.075;transform:translate(-50%,-50%)}.content{position:relative;z-index:1}.agreement-line{text-align:center;font-weight:700;font-size:11pt;margin:0 0 7mm}.section-title{margin:5mm 0 3mm;font-size:11pt;font-weight:700;text-decoration:underline}.section-title:first-child{margin-top:0}.lead{margin:0 0 4mm;text-align:justify}.service-meta{display:grid;grid-template-columns:auto 1fr;gap:2mm 4mm;margin:3mm 0;font-weight:700}.scope{margin:3mm 0 5mm;padding-left:7mm}.scope li{margin:1mm 0}.fee-box{margin:3mm 0 5mm}.fee-line{display:grid;grid-template-columns:45mm 1fr;gap:3mm;font-weight:700}.fee-note{margin:0 0 1.5mm 48mm;font-size:9pt;font-style:italic}.signature-row{display:grid;grid-template-columns:1fr 1fr;gap:35mm;margin-top:10mm}.signature{padding-top:1.5mm;border-top:.35mm solid #111;font-weight:700}.brand-footer{position:absolute;inset:auto 0 0;height:25mm;background:#070707}.brand-footer:before{content:"SHAB Legal Consultants FZC";position:absolute;left:12mm;top:8mm;width:83mm;padding:4mm 6mm;background:#dfa91a;color:#fff;font-family:Arial,sans-serif;font-size:9pt;clip-path:polygon(0 0,88% 0,100% 100%,0 100%)}.brand-footer:after{content:"";position:absolute;right:8mm;top:-8mm;width:70mm;height:20mm;background:#fff;border:2mm solid #070707;transform:skewX(-34deg)}.page-ref{position:absolute;right:11mm;bottom:4mm;z-index:3;color:#fff;font-family:Arial,sans-serif;font-size:7pt}.compact p{margin:0 0 3mm;text-align:justify}.compact .section-title{margin:3mm 0 1.5mm}.compact .signature-row{margin-top:12mm}@media screen and (max-width:900px){body{padding:12px}.page{width:100%;min-height:auto;margin:0 0 12px;padding:150px 28px 125px}.brand-header{height:125px}.brand-logo{width:280px;height:115px}.brand-logo img{width:180px;height:100px}.brand-footer{height:95px}}@media print{html,body{background:#fff}.page{margin:0;width:210mm;height:297mm;min-height:297mm}.page-ref{display:none}}
</style></head><body>
<section class="page"><header class="brand-header"><div class="brand-logo"><img src="${escapeHtml(logoUrl)}" alt="SHAB Legal Consultants FZC"></div></header><img class="watermark" src="${escapeHtml(logoUrl)}" alt=""><main class="content">
<p class="agreement-line">This Service Agreement (“SA”) is made and entered into as of ${formatDate(agreement.agreement_date)}</p>
<h2 class="section-title">Parties:</h2>
<p class="lead">The legal services are provided by <strong>“${escapeHtml(company.name)}”</strong>, registered office located at ${escapeHtml(company.address)}. (Hereinafter referred to as <strong>“First Party”</strong>).</p>
<p class="lead">The legal services are provided to <strong>“${escapeHtml(client.name)}”</strong>${client.contactName ? ` represented by ${escapeHtml(client.contactName)}` : ''}, having correspondence details ${escapeHtml([client.phone, client.email].filter(Boolean).join(' · ') || 'not provided')}${client.address ? ` and address ${escapeHtml(client.address)}` : ''}. (Hereinafter referred to as <strong>“Second Party”</strong>).</p>
<h2 class="section-title">Services:</h2><p>The Second Party hereby agrees to engage the First Party to perform the below mentioned services:</p>
<div class="service-meta"><span>Category:</span><span>${escapeHtml(agreement.service_category || 'Legal Services')}</span><span>Service:</span><span>${escapeHtml(agreement.service_subcategory || agreement.title)}${caseReference ? ` · Matter ${escapeHtml(caseReference)}` : ''}</span></div>
<ul class="scope">${scope.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
<h2 class="section-title">Service fees:</h2><div class="fee-box">${feeLines || `<div class="fee-line"><strong>Professional Fees</strong><span>${formatMoney(Number(agreement.agreed_fee), agreement.currency)} exclusive of applicable VAT</span></div>`}${successFee}</div>
<h2 class="section-title">Confidentiality</h2><p class="lead">The parties understand, acknowledge and agree that all written and verbal information and materials disclosed or provided by the Second Party to the First Party under this agreement are confidential in nature, regardless of the date of submission. All such information and materials will be treated with the utmost confidentiality, subject to professional duties and applicable law.</p>
<div class="signature-row"><div class="signature">FIRST PARTY</div><div class="signature">SECOND PARTY</div></div></main><footer class="brand-footer"></footer><span class="page-ref">${escapeHtml(agreement.agreement_number)} · 1 / 2</span></section>
<section class="page"><header class="brand-header"><div class="brand-logo"><img src="${escapeHtml(logoUrl)}" alt="SHAB Legal Consultants FZC"></div></header><img class="watermark" src="${escapeHtml(logoUrl)}" alt=""><main class="content compact">
<h2 class="section-title">Expenses:</h2><p>The service fee is exclusive of court, judicial, expert, translation, administrative and other third-party charges. The Second Party shall reimburse approved direct costs and any government or judicial fees incurred by the First Party. Receipts will be provided where issued by the relevant authority or supplier.</p>
<h2 class="section-title">Payment:</h2><p>The Second Party shall pay all invoices within ${agreement.payment_terms_days} day${agreement.payment_terms_days === 1 ? '' : 's'} from the invoice date. If an invoice is not paid when due, the First Party may suspend or delay the work. Paid professional fees are non-refundable once this agreement has been signed, subject to applicable law and any written agreement between the parties.</p>
<h2 class="section-title">Performance of Service:</h2><p>The First Party will be responsible for performing and presenting the work within the scope of services mentioned in this SA and shall use its best professional efforts while observing applicable ethical obligations. The First Party cannot guarantee that any particular result, judgment, recovery or outcome will be achieved.</p>
<h2 class="section-title">Termination:</h2><p>Both parties may terminate this agreement if either party violates a contractual obligation and does not remedy that violation within fourteen days from written notice. Fees, approved costs and liabilities accrued before termination remain payable.</p>
<h2 class="section-title">Dispute Resolution &amp; Jurisdiction</h2><p>Any dispute arising out of or in connection with this agreement shall be settled by arbitration under the Rules of the Dubai International Arbitration Centre by one or more arbitrators appointed in accordance with those Rules, unless the parties agree otherwise in writing.</p>
<div class="signature-row"><div class="signature">FIRST PARTY<br><span>${escapeHtml(company.name)}</span><br>Name and signature:<br>Date:</div><div class="signature">SECOND PARTY<br><span>${escapeHtml(client.name)}</span><br>Signatory: ${escapeHtml(agreement.client_signatory_name || '')}<br>Title: ${escapeHtml(agreement.client_signatory_title || '')}<br>Date:</div></div>
</main><footer class="brand-footer"></footer><span class="page-ref">${escapeHtml(agreement.agreement_number)} · 2 / 2 · Terms ${escapeHtml(agreement.standard_terms_version)}</span></section>
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
