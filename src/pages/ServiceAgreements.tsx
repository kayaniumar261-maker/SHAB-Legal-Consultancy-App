import { useEffect, useMemo, useState } from 'react';
import { FilePlus2, ScrollText, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getServiceAgreementRegister, type ServiceAgreementRegisterRow } from '../services/feeAgreementService';
import './ServiceAgreements.css';

export function ServiceAgreements() {
  const [rows, setRows] = useState<ServiceAgreementRegisterRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getServiceAgreementRegister()
      .then((data) => { if (active) setRows(data); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'Unable to load agreements.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) => [row.agreement_number, row.title, row.service_category, row.service_subcategory, row.client?.full_name, row.client?.company_name, row.case?.case_number, row.case?.matter_number]
      .some((value) => value?.toLowerCase().includes(query)));
  }, [rows, search]);

  const generated = rows.filter((row) => row.agreement_document_id).length;
  const signed = rows.filter((row) => row.document_status === 'signed').length;

  return <div className="service-agreements-page page-container">
    <section className="service-agreements-heading">
      <div><p className="page-eyebrow">Engagement management</p><h2>Service Agreements</h2><p>Prepare client engagement terms, track document status, and continue billing through the linked matter.</p></div>
      <div className="service-agreements-actions"><Link className="secondary-action-button" to="/clients"><FilePlus2 size={17}/>New Client</Link><Link className="primary-action-button" to="/cases/new?agreement=1"><ScrollText size={17}/>New Matter &amp; Agreement</Link></div>
    </section>
    <section className="service-agreement-stats"><div><span>Total agreements</span><strong>{rows.length}</strong></div><div><span>Documents generated</span><strong>{generated}</strong></div><div><span>Signed</span><strong>{signed}</strong></div></section>
    <section className="service-agreement-register">
      <div className="service-agreement-toolbar"><label><Search size={16}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search client, matter or agreement" /></label></div>
      {error ? <div className="service-agreement-state error">{error}</div> : loading ? <div className="service-agreement-state">Loading agreements…</div> : filtered.length === 0 ? <div className="service-agreement-state">No service agreements found. Create a client and matter, then open Agreement &amp; Billing.</div> :
      <div className="service-agreement-table-wrap"><table><thead><tr><th>Agreement</th><th>Client</th><th>Service</th><th>Matter</th><th>Fees</th><th>Document</th></tr></thead><tbody>{filtered.map((row) => <tr key={row.id}>
        <td><strong>{row.agreement_number}</strong><span>{row.title}</span></td>
        <td><Link to={`/clients/${row.client_id}`}>{row.client?.company_name || row.client?.full_name || 'Client'}</Link></td>
        <td><strong>{row.service_category || 'Not set'}</strong><span>{row.service_subcategory || '—'}</span></td>
        <td>{row.case_id ? <Link to={`/cases/${row.case_id}`}>{row.case?.matter_number || row.case?.case_number || row.case?.case_type || 'Open matter'}</Link> : <span>Client-level</span>}</td>
        <td><strong>{money(Number(row.agreed_fee), row.currency)}</strong><span>{row.installments.length} fee stage{row.installments.length === 1 ? '' : 's'}</span></td>
        <td><span className={`agreement-document-status ${row.document_status}`}>{row.document_status}</span>{row.agreement_document_version > 0 && <small>v{row.agreement_document_version}</small>}</td>
      </tr>)}</tbody></table></div>}
    </section>
  </div>;
}

function money(amount: number, currency: string) {
  return new Intl.NumberFormat('en-AE', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
}
