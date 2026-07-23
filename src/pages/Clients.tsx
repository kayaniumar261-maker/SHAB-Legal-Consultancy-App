import {
  Building2,
  Edit3,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Link } from 'react-router-dom';

import {
  createClient,
  deleteClient,
  getClients,
  updateClient,
} from '../services/clientService';
import type { Client } from '../types/client';
import { ClientFormModal } from '../components/clients/ClientFormModal';
import { DeleteClientModal } from '../components/clients/DeleteClientModal';
import './Clients.css';

type StatusFilter = Client['status'] | 'all';
type TypeFilter = Client['client_type'] | 'all';

const PAGE_SIZE = 12;

export function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
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

      setClients(result.data);
      setTotalClients(result.count);
    } catch (fetchError) {
      if (fetchError instanceof Error) {
        setError(fetchError.message);
      } else {
        setError('Unable to load clients.');
      }
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter, clientTypeFilter, page]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const filteredLabel = useMemo(() => {
    if (searchTerm || statusFilter !== 'all' || clientTypeFilter !== 'all') {
      return 'Filtered results';
    }

    return 'All clients';
  }, [searchTerm, statusFilter, clientTypeFilter]);

  const statusBadgeClass = (status: Client['status']) => {
    return `status-badge ${status}`;
  };

  const typeBadgeClass = (type: Client['client_type']) => {
    return `type-badge ${type}`;
  };

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
    data: Parameters<typeof createClient>[0] | Parameters<typeof updateClient>[1],
  ) => {
    setFormLoading(true);
    try {
      if (id) {
        const updated = await updateClient(id, data as Parameters<typeof updateClient>[1]);
        setClients((current) =>
          current.map((client) =>
            client.id === id ? updated : client,
          ),
        );
      } else {
        const created = await createClient(data as Parameters<typeof createClient>[0]);
        setClients((current) => [created, ...current]);
        setTotalClients((current) => current + 1);
      }
    } finally {
      setFormLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    setDeleteLoading(true);
    try {
      await deleteClient(deleteTarget.id);
      setClients((current) =>
        current.filter((client) => client.id !== deleteTarget.id),
      );
      setTotalClients((current) => Math.max(0, current - 1));
      setDeleteTarget(null);
    } catch (deleteError) {
      if (deleteError instanceof Error) {
        setError(deleteError.message);
      } else {
        setError('Unable to delete client.');
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  const closeDelete = () => {
    setDeleteTarget(null);
  };

  const startDelete = (client: Client) => {
    setDeleteTarget(client);
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setPage(1);
  };

  const handleStatusChange = (value: StatusFilter) => {
    setStatusFilter(value);
    setPage(1);
  };

  const handleTypeChange = (value: TypeFilter) => {
    setClientTypeFilter(value);
    setPage(1);
  };

  const pageCount = Math.max(1, Math.ceil(totalClients / PAGE_SIZE));

  return (
    <div className="clients-page page-container">
      <section className="page-heading clients-heading">
        <div>
          <p className="page-eyebrow">Client management</p>
          <h2>Clients</h2>
          <p className="page-intro">
            Manage client records, onboarding status, identification, and company details with direct access to every client profile.
          </p>
        </div>

        <button
          type="button"
          className="primary-action-button"
          onClick={openNewClient}
        >
          <Plus size={18} />
          Add Client
        </button>
      </section>

      <section className="clients-toolbar">
        <div className="clients-search">
          <Search size={18} />
          <input
            value={searchTerm}
            onChange={(event) =>
              handleSearchChange(event.target.value)
            }
            placeholder="Search clients, phone, email, company, Emirates ID, passport"
            aria-label="Search clients"
          />
        </div>

        <div className="clients-filters">
          <div className="filter-field">
            <label>Status</label>
            <select
              value={statusFilter}
              onChange={(event) =>
                handleStatusChange(
                  event.target.value as StatusFilter,
                )
              }
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="prospect">Prospect</option>
            </select>
          </div>

          <div className="filter-field">
            <label>Client type</label>
            <select
              value={clientTypeFilter}
              onChange={(event) =>
                handleTypeChange(
                  event.target.value as TypeFilter,
                )
              }
            >
              <option value="all">All types</option>
              <option value="individual">Individual</option>
              <option value="company">Company</option>
            </select>
          </div>
        </div>
      </section>

      <section className="clients-status-row">
        <div>
          <strong>{filteredLabel}</strong>
          <span>{totalClients} total clients</span>
        </div>

        <div>
          {loading ? (
            <span>Loading clients…</span>
          ) : (
            <span>
              Showing {clients.length} of {totalClients}
            </span>
          )}
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
              <th>Type</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Identification</th>
              <th>Status</th>
              <th>Created Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="clients-loading-cell">
                  Loading clients…
                </td>
              </tr>
            ) : clients.length === 0 ? (
              <tr>
                <td colSpan={8} className="clients-empty-cell">
                  No clients match the current filters.
                </td>
              </tr>
            ) : (
              clients.map((client) => (
                <tr key={client.id}>
                  <td className="client-name-cell">
                    <div className="client-name-stack">
                      <strong>{client.full_name}</strong>
                      {client.company_name && (
                        <span>{client.company_name}</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className={typeBadgeClass(client.client_type)}>
                      {client.client_type}
                    </span>
                  </td>
                  <td>{client.phone ?? '-'}</td>
                  <td>{client.email ?? '-'}</td>
                  <td>
                    {client.emirates_id || client.passport_number || '-'}
                  </td>
                  <td>
                    <span className={statusBadgeClass(client.status)}>
                      {client.status}
                    </span>
                  </td>
                  <td>{formatDate(client.created_at)}</td>
                  <td className="table-actions">
                    <Link
                      className="action-link"
                      to={`/clients/${client.id}`}
                    >
                      View
                    </Link>
                    <button
                      type="button"
                      className="action-button"
                      onClick={() => openEditClient(client)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="action-button danger"
                      onClick={() => startDelete(client)}
                    >
                      Delete
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
          onClick={() => setPage((current) => Math.max(1, current - 1))}
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
        open={Boolean(deleteTarget)}
        clientName={deleteTarget?.full_name ?? ''}
        loading={deleteLoading}
        onCancel={closeDelete}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

type ClientDetailProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
};

function ClientDetail({
  icon,
  label,
  value,
}: ClientDetailProps) {
  return (
    <div className="client-detail-row">
      <div className="client-detail-icon">
        {icon}
      </div>

      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

type FormFieldProps = {
  label: string;
  required?: boolean;
  wide?: boolean;
  children: React.ReactNode;
};

function FormField({
  label,
  required = false,
  wide = false,
  children,
}: FormFieldProps) {
  return (
    <label
      className={[
        'client-form-field',
        wide ? 'client-form-field-wide' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span>
        {label}
        {required && (
          <strong aria-hidden="true">
            *
          </strong>
        )}
      </span>

      {children}
    </label>
  );
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  return new Intl.DateTimeFormat('en-AE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}
