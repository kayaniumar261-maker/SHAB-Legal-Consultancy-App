import { tr, getLocale, useLocale } from '../i18n/locale';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';
import { FilePlus2, ScrollText, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getServiceAgreementRegister, type ServiceAgreementRegisterRow } from '../services/feeAgreementService';
import './ServiceAgreements.css';

export function ServiceAgreements() {
  const interfaceLanguage = useLocale();
  const [rows, setRows] = useState<ServiceAgreementRegisterRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null); setLoading(true);
      setRows(await getServiceAgreementRegister());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load agreements.');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useRealtimeRefresh(['fee_agreements', 'fee_installments', 'clients', 'cases'], load);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) => [row.agreement_number, row.title, row.service_category, row.service_subcategory, row.client?.full_name, row.client?.company_name, row.case?.case_number, row.case?.matter_number]
      .some((value) => value?.toLowerCase().includes(query)));
  }, [rows, search, interfaceLanguage]);

  const generated = rows.filter((row) => row.agreement_document_id).length;
  const signed = rows.filter((row) => row.document_status === 'signed').length;

  return <div className="service-agreements-page page-container">
    <section className="service-agreements-heading">
      <div><p className="page-eyebrow">{tr("Engagement management")}</p><h2>{tr("Service Agreements")}</h2><p>{tr("Prepare client engagement terms, track document status, and continue billing through the linked matter.")}</p></div>
      <div className="service-agreements-actions"><Link className="secondary-action-button" to="/clients"><FilePlus2 size={17}/>{tr("New Client")}</Link><Link className="primary-action-button" to="/cases/new?agreement=1"><ScrollText size={17}/>{tr("New Matter & Agreement")}</Link></div>
    </section>
    <section className="service-agreement-stats"><div><span>{tr("Total agreements")}</span><strong>{rows.length}</strong></div><div><span>{tr("Documents generated")}</span><strong>{generated}</strong></div><div><span>{tr("Signed")}</span><strong>{signed}</strong></div></section>
    <section className="service-agreement-register">
      <div className="service-agreement-toolbar"><label><Search size={16}/><input dir="auto" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tr("Search client, matter or agreement")} /></label></div>
      {error ? <div className="service-agreement-state error">{tr(error)}</div> : loading ? <div className="service-agreement-state">{tr("Loading agreements…")}</div> : filtered.length === 0 ? <div className="service-agreement-state">{tr("No service agreements found. Create a client and matter, then open Agreement & Billing.")}</div> :
      <div className="service-agreement-table-wrap"><table><thead><tr><th>{tr("Agreement")}</th><th>{tr("Client")}</th><th>{tr("Service")}</th><th>{tr("Matter")}</th><th>{tr("Fees")}</th><th>{tr("Document")}</th></tr></thead><tbody>{filtered.map((row) => <tr key={row.id}>
        <td><strong>{row.agreement_number}</strong><span>{row.title}</span></td>
        <td><Link to={`/clients/${row.client_id}`}>{row.client?.company_name || row.client?.full_name || tr("Client")}</Link></td>
        <td><strong>{row.service_category || tr("Not set")}</strong><span>{row.service_subcategory || '—'}</span></td>
        <td>{row.case_id ? <Link to={`/cases/${row.case_id}`}>{row.case?.matter_number || row.case?.case_number || row.case?.case_type || tr("Open matter")}</Link> : <span>{tr("Client-level")}</span>}</td>
        <td><strong>{money(Number(row.agreed_fee), row.currency)}</strong><span>{row.installments.length}{" "}{tr("fee stage")}{row.installments.length === 1 ? '' : 's'}</span></td>
        <td><span className={`agreement-document-status ${row.document_status}`}>{row.document_status}</span>{row.agreement_document_version > 0 && <small>v{row.agreement_document_version}</small>}</td>
      </tr>)}</tbody></table></div>}
    </section>
  </div>;
}

function money(amount: number, currency: string) {
  return new Intl.NumberFormat(getLocale("en-AE"), { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
}
