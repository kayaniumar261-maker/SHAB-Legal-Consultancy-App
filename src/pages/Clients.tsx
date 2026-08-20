import {
  Building2,
  CircleDollarSign,
  Edit3,
  FileSpreadsheet,
  FolderKanban,
  Mail,
  Phone,
  Plus,
  Search,
  ShieldAlert,
  Star,
  Trash2,
  UserRound,
  UsersRound,
} from 'lucide-react';
import {
  ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link } from 'react-router-dom';

import { useAccessProfile } from '../hooks/useAccessProfile';

import {
  createClient,
  deleteClient,
  getClients,
  updateClient,
} from '../services/clientService';
import type { Client } from '../types/client';
import {
  EMPTY_FINANCE_SUMMARY,
  getClientFinanceSummaries,
  type AuthoritativeFinanceSummary,
} from '../services/financeSummaryService';
import { ClientFormModal } from '../components/clients/ClientFormModal';
import { DeleteClientModal } from '../components/clients/DeleteClientModal';
import { DeletionRequestModal } from '../components/staff/DeletionRequestModal';
import './Clients.css';

type StatusFilter = Client['status'] | 'all';
type TypeFilter = Client['client_type'] | 'all';

type ProfessionalClient = Client & {
  client_code?: string | null;
  legacy_client_id?: string | null;
  whatsapp?: string | null;
  source?: string | null;
  vip?: boolean | null;
  risk_level?: 'low' | 'medium' | 'high' | null;
  total_cases?: number | null;
  active_cases?: number | null;
  outstanding_balance?: number | string | null;
};

const PAGE_SIZE = 12;

export function Clients() {
  const { profile } = useAccessProfile();
  const administrator =
    profile?.access_role === 'administrator' && profile.is_active;
  const [clients, setClients] = useState<ProfessionalClient[]>([]);
  const [financeSummaries, setFinanceSummaries] = useState<
    Record<string, AuthoritativeFinanceSummary>
  >({});
  const [totalClients, setTotalClients] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [clientTypeFilter, setClientTypeFilter] = useState<TypeFilter>('all');
  const [page, setPage] = useState(1);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [activeClient, setActiveClient] = useState<Client | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await getClients({
        search: searchTerm,
        status: statusFilter,
        clientType: clientTypeFilter,
        page,
        pageSize: PAGE_SIZE,
      });

      const nextClients = result.data as ProfessionalClient[];
      const nextFinanceSummaries = administrator
        ? await getClientFinanceSummaries(
            nextClients.map((client) => client.id),
          )
        : {};

      setClients(nextClients);
      setFinanceSummaries(nextFinanceSummaries);
      setTotalClients(result.count);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : 'Unable to load clients.',
      );
    } finally {
      setLoading(false);
    }
  }, [administrator, searchTerm, statusFilter, clientTypeFilter, page]);

  useEffect(() => {
    void fetchClients();
  }, [fetchClients]);

  const filteredLabel = useMemo(() => {
    if (searchTerm || statusFilter !== 'all' || clientTypeFilter !== 'all') {
      return 'Filtered results';
    }

    return 'All clients';
  }, [searchTerm, statusFilter, clientTypeFilter]);

  const summary = useMemo(() => {
    return clients.reduce(
      (current, client) => {
        current.active += client.status === 'active' ? 1 : 0;
        current.companies += client.client_type === 'company' ? 1 : 0;
        current.vip += client.vip ? 1 : 0;
        current.cases += Number(client.total_cases ?? 0);
        const finance =
          financeSummaries[client.id] ?? EMPTY_FINANCE_SUMMARY;

        if (finance.hasMixedCurrencies) {
          current.hasMixedCurrencies = true;
        } else if ((finance.currency ?? 'AED') === 'AED') {
          current.outstanding += finance.outstanding;
        } else if (finance.outstanding !== 0) {
          current.hasMixedCurrencies = true;
        }
        return current;
      },
      {
        active: 0,
        companies: 0,
        vip: 0,
        cases: 0,
        outstanding: 0,
        hasMixedCurrencies: false,
      },
    );
  }, [clients, financeSummaries]);

  const openNewClient = () => {
    setActiveClient(null);
    setIsFormOpen(true);
  };

  const openEditClient = (client: Client) => {
    setActiveClient(client);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setActiveClient(null);
    setIsFormOpen(false);
  };

  const handleSave = async (
    id: string | null,
    data:
      | Parameters<typeof createClient>[0]
      | Parameters<typeof updateClient>[1],
  ) => {
    setFormLoading(true);
    setError(null);

    try {
      if (id) {
        await updateClient(
          id,
          data as Parameters<typeof updateClient>[1],
        );
      } else {
        await createClient(
          data as Parameters<typeof createClient>[0],
        );
      }

      closeForm();
      await fetchClients();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Unable to save client.',
      );
      throw saveError;
    } finally {
      setFormLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    setDeleteLoading(true);
    setError(null);

    try {
      await deleteClient(deleteTarget.id);
      setDeleteTarget(null);

      if (clients.length === 1 && page > 1) {
        setPage((current) => current - 1);
      } else {
        await fetchClients();
      }
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Unable to delete client.',
      );
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleImportClick = () => {
    importInputRef.current?.click();
  };

  const handleImportFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setError(
      `Selected "${file.name}". The Excel mapping and duplicate-check wizard will be connected in the next step.`,
    );

    event.target.value = '';
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setClientTypeFilter('all');
    setPage(1);
  };

  const pageCount = Math.max(1, Math.ceil(totalClients / PAGE_SIZE));
  const hasFilters =
    Boolean(searchTerm) ||
    statusFilter !== 'all' ||
    clientTypeFilter !== 'all';

  return (
    <div className="clients-page page-container">
      <section className="page-heading clients-heading">
        <div>
          <p className="page-eyebrow">Client relationship management</p>
          <h2>Clients</h2>
          <p className="page-intro">
            {administrator
              ? 'Manage client profiles, linked matters, identification, communication details, risk indicators, and outstanding balances.'
              : 'Manage client profiles, linked matters, identification and communication details.'}
          </p>
        </div>

        <div className="clients-heading-actions">
          <input
            ref={importInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            hidden
            onChange={handleImportFile}
          />

          {administrator && (
            <button
              type="button"
              className="secondary-action-button"
              onClick={handleImportClick}
            >
              <FileSpreadsheet size={18} />
              Import Excel
            </button>
          )}

          <button
            type="button"
            className="primary-action-button"
            onClick={openNewClient}
          >
            <Plus size={18} />
            Add Client
          </button>
        </div>
      </section>

      <section className="client-summary-grid" aria-label="Client summary">
        <SummaryCard
          icon={<UsersRound size={20} />}
          label="Total clients"
          value={formatNumber(totalClients)}
          detail={`${filteredLabel}`}
        />
        <SummaryCard
          icon={<UserRound size={20} />}
          label="Active on this page"
          value={formatNumber(summary.active)}
          detail={`of ${clients.length} displayed`}
        />
        <SummaryCard
          icon={<Building2 size={20} />}
          label="Companies"
          value={formatNumber(summary.companies)}
          detail="Displayed page"
        />
        <SummaryCard
          icon={<FolderKanban size={20} />}
          label="Linked cases"
          value={formatNumber(summary.cases)}
          detail="Displayed page"
        />
        {administrator && (
          <SummaryCard
            icon={<CircleDollarSign size={20} />}
            label="Outstanding"
            value={
              summary.hasMixedCurrencies
                ? 'Mixed currencies'
                : formatCurrency(summary.outstanding)
            }
            detail="Live ledger · displayed page"
          />
        )}
      </section>

      <section className="clients-toolbar">
        <div className="clients-search">
          <Search size={18} />
          <input
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value);
              setPage(1);
            }}
            placeholder="Search name, code, phone, email, company, Emirates ID or passport"
            aria-label="Search clients"
          />
        </div>

        <div className="clients-filters">
          <div className="filter-field">
            <label htmlFor="client-status-filter">Status</label>
            <select
              id="client-status-filter"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as StatusFilter);
                setPage(1);
              }}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="prospect">Prospect</option>
            </select>
          </div>

          <div className="filter-field">
            <label htmlFor="client-type-filter">Client type</label>
            <select
              id="client-type-filter"
              value={clientTypeFilter}
              onChange={(event) => {
                setClientTypeFilter(event.target.value as TypeFilter);
                setPage(1);
              }}
            >
              <option value="all">All types</option>
              <option value="individual">Individual</option>
              <option value="company">Company</option>
            </select>
          </div>

          {hasFilters && (
            <button
              type="button"
              className="clear-filter-button"
              onClick={clearFilters}
            >
              Clear filters
            </button>
          )}
        </div>
      </section>

      <section className="clients-status-row">
        <div>
          <strong>{filteredLabel}</strong>
          <span>{formatNumber(totalClients)} total clients</span>
        </div>

        <div>
          <span>
            {loading
              ? 'Loading clients…'
              : `Showing ${clients.length} of ${totalClients}`}
          </span>
        </div>
      </section>

      {error && (
        <div className="clients-error" role="alert">
          {error}
        </div>
      )}

      <section className="clients-table-wrap">
        <table className="clients-table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Contact</th>
              <th>Type</th>
              <th>Cases</th>
              {administrator && <th>Outstanding</th>}
              <th>Status</th>
              <th>Risk</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={administrator ? 8 : 7} className="clients-loading-cell">
                  Loading clients…
                </td>
              </tr>
            ) : clients.length === 0 ? (
              <tr>
                <td colSpan={administrator ? 8 : 7} className="clients-empty-cell">
                  <UserRound size={30} />
                  <strong>No clients found</strong>
                  <span>
                    Change the filters or create a new client profile.
                  </span>
                </td>
              </tr>
            ) : (
              clients.map((client) => (
                <tr key={client.id}>
                  <td className="client-name-cell" data-label="Client">
                    <div className="client-avatar">
                      {getInitials(client.full_name)}
                    </div>

                    <div className="client-name-stack">
                      <div className="client-title-line">
                        <Link to={`/clients/${client.id}`}>
                          {client.full_name}
                        </Link>

                        {client.vip && (
                          <span className="vip-indicator" title="VIP client">
                            <Star size={14} fill="currentColor" />
                            VIP
                          </span>
                        )}
                      </div>

                      <span>
                        {client.client_code ?? 'Code pending'}
                        {client.company_name
                          ? ` · ${client.company_name}`
                          : ''}
                      </span>
                    </div>
                  </td>

                  <td data-label="Contact">
                    <div className="client-contact-stack">
                      <span>
                        <Phone size={14} />
                        {client.phone ?? 'No phone'}
                      </span>
                      <span>
                        <Mail size={14} />
                        {client.email ?? 'No email'}
                      </span>
                    </div>
                  </td>

                  <td data-label="Type">
                    <span
                      className={`type-badge ${client.client_type}`}
                    >
                      {formatLabel(client.client_type)}
                    </span>
                  </td>

                  <td data-label="Cases">
                    <div className="case-count-cell">
                      <strong>{Number(client.total_cases ?? 0)}</strong>
                      <span>
                        {Number(client.active_cases ?? 0)} active
                      </span>
                    </div>
                  </td>

                  {administrator && (
                    <td data-label="Outstanding">
                      <strong className="balance-value">
                        {formatFinanceAmount(
                          financeSummaries[client.id],
                        )}
                      </strong>
                    </td>
                  )}

                  <td data-label="Status">
                    <span className={`status-badge ${client.status}`}>
                      {formatLabel(client.status)}
                    </span>
                  </td>

                  <td data-label="Risk">
                    <RiskBadge risk={client.risk_level ?? 'low'} />
                  </td>

                  <td className="table-actions" data-label="Actions">
                    <Link
                      className="action-link"
                      to={`/clients/${client.id}`}
                    >
                      View
                    </Link>

                    <button
                      type="button"
                      className="icon-action-button"
                      title="Edit client"
                      aria-label={`Edit ${client.full_name}`}
                      onClick={() => openEditClient(client)}
                    >
                      <Edit3 size={16} />
                    </button>

                    <button
                      type="button"
                      className="icon-action-button danger"
                      title={administrator ? 'Delete client' : 'Request client deletion'}
                      aria-label={`${administrator ? 'Delete' : 'Request deletion of'} ${client.full_name}`}
                      onClick={() => setDeleteTarget(client)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="pagination-controls">
        <button
          type="button"
          onClick={() =>
            setPage((current) => Math.max(1, current - 1))
          }
          disabled={page === 1 || loading}
        >
          Previous
        </button>

        <span>
          Page {page} of {pageCount}
        </span>

        <button
          type="button"
          onClick={() =>
            setPage((current) => Math.min(pageCount, current + 1))
          }
          disabled={page >= pageCount || loading}
        >
          Next
        </button>
      </section>

      <ClientFormModal
        open={isFormOpen}
        client={activeClient}
        onClose={closeForm}
        onSave={handleSave}
        loading={formLoading}
      />

      <DeleteClientModal
        open={administrator && Boolean(deleteTarget)}
        clientName={deleteTarget?.full_name ?? ''}
        loading={deleteLoading}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />

      <DeletionRequestModal
        open={!administrator && Boolean(deleteTarget)}
        entityType="client"
        recordId={deleteTarget?.id ?? null}
        recordLabel={deleteTarget?.full_name ?? 'Client record'}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

type SummaryCardProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
};

function SummaryCard({
  icon,
  label,
  value,
  detail,
}: SummaryCardProps) {
  return (
    <article className="client-summary-card">
      <div className="client-summary-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  );
}

function RiskBadge({
  risk,
}: {
  risk: NonNullable<ProfessionalClient['risk_level']>;
}) {
  return (
    <span className={`risk-badge ${risk}`}>
      {risk !== 'low' && <ShieldAlert size={14} />}
      {formatLabel(risk)}
    </span>
  );
}

function getInitials(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return initials || 'CL';
}

function formatLabel(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-AE').format(value);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency: 'AED',
    maximumFractionDigits: 2,
  }).format(value);
}

function formatFinanceAmount(
  summary?: AuthoritativeFinanceSummary,
): string {
  const finance = summary ?? EMPTY_FINANCE_SUMMARY;

  if (finance.hasMixedCurrencies) {
    return 'Mixed currencies';
  }

  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency: finance.currency ?? 'AED',
    maximumFractionDigits: 2,
  }).format(finance.outstanding);
}
