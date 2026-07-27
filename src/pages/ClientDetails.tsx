import {
  ArrowLeft,
  BadgeDollarSign,
  Building2,
  CalendarDays,
  CircleUserRound,
  FileText,
  FolderKanban,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  ReceiptText,
  ShieldAlert,
  Star,
  UserRound,
  WalletCards,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import {
  getClientById,
  type ClientOverview,
} from '../services/clientService';
import './ClientDetails.css';

type ClientTab =
  | 'overview'
  | 'cases'
  | 'hearings'
  | 'documents'
  | 'invoices'
  | 'payments'
  | 'timeline'
  | 'notes';

const tabs: Array<{
  id: ClientTab;
  label: string;
}> = [
  { id: 'overview', label: 'Overview' },
  { id: 'cases', label: 'Cases' },
  { id: 'hearings', label: 'Hearings' },
  { id: 'documents', label: 'Documents' },
  { id: 'invoices', label: 'Invoices' },
  { id: 'payments', label: 'Payments' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'notes', label: 'Notes' },
];

export function ClientDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [client, setClient] = useState<ClientOverview | null>(null);
  const [activeTab, setActiveTab] = useState<ClientTab>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError('Client ID is missing.');
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadClient(clientId: string) {
      setLoading(true);
      setError(null);

      try {
        const data = await getClientById(clientId);

        if (cancelled) {
          return;
        }

        if (!data) {
          setError('Client not found.');
          return;
        }

        setClient(data);
      } catch (fetchError) {
        if (cancelled) {
          return;
        }

        setError(
          fetchError instanceof Error
            ? fetchError.message
            : 'Unable to load client details.',
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadClient(id);

    return () => {
      cancelled = true;
    };
  }, [id]);

  const displayAddress = useMemo(() => {
    if (!client) {
      return 'Not provided';
    }

    const structuredAddress = [
      client.area,
      client.city,
      client.emirate,
      client.country,
    ]
      .filter(Boolean)
      .join(', ');

    return structuredAddress || client.address || 'Not provided';
  }, [client]);

  if (loading) {
    return (
      <div className="client-details-page page-container">
        <div className="details-loading">
          <div className="details-loading-spinner" />
          <strong>Loading client profile…</strong>
          <span>Retrieving the latest client and matter information.</span>
        </div>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="client-details-page page-container">
        <div className="details-error">
          <ShieldAlert size={24} />
          <div>
            <strong>Unable to open client profile</strong>
            <span>{error ?? 'Client not found.'}</span>
          </div>
        </div>

        <button
          type="button"
          className="secondary-action-button"
          onClick={() => navigate('/clients')}
        >
          <ArrowLeft size={17} />
          Back to Clients
        </button>
      </div>
    );
  }

  const isVip = Boolean(client.is_vip ?? client.vip);
  const riskLevel = client.risk_level ?? 'low';

  return (
    <div className="client-details-page page-container">
      <section className="client-profile-hero">
        <div className="client-profile-identity">
          <div className="client-profile-avatar">
            {getInitials(client.full_name)}
          </div>

          <div>
            <div className="client-profile-code-line">
              <span className="client-profile-code">
                {client.client_code ?? 'Client code pending'}
              </span>

              {isVip && (
                <span className="client-vip-badge">
                  <Star size={14} fill="currentColor" />
                  VIP Client
                </span>
              )}

              <span className={`status-badge ${client.status}`}>
                {formatLabel(client.status)}
              </span>

              <span className={`risk-badge ${riskLevel}`}>
                {riskLevel !== 'low' && <ShieldAlert size={14} />}
                {formatLabel(riskLevel)} Risk
              </span>
            </div>

            <h2>{client.full_name}</h2>

            <p>
              {client.company_name
                ? client.company_name
                : formatLabel(client.client_type)}
              {client.nationality ? ` · ${client.nationality}` : ''}
            </p>
          </div>
        </div>

        <div className="client-profile-actions">
          <button
            type="button"
            className="secondary-action-button"
            onClick={() => navigate('/clients')}
          >
            <ArrowLeft size={17} />
            Back
          </button>

          <Link
            className="secondary-action-button"
            to={`/cases?clientId=${client.id}`}
          >
            <FolderKanban size={17} />
            View Cases
          </Link>

          <Link
            className="primary-action-button"
            to={`/cases/new?clientId=${client.id}`}
          >
            <Plus size={17} />
            New Case
          </Link>
        </div>
      </section>

      <section className="client-profile-summary-grid">
        <ProfileStat
          icon={<FolderKanban size={20} />}
          label="Total Cases"
          value={formatNumber(client.total_cases)}
          helper={`${formatNumber(client.active_cases)} active`}
        />
        <ProfileStat
          icon={<CalendarDays size={20} />}
          label="Hearings"
          value={formatNumber(client.total_hearings)}
          helper="All recorded hearings"
        />
        <ProfileStat
          icon={<FileText size={20} />}
          label="Documents"
          value={formatNumber(client.total_documents)}
          helper="Files on record"
        />
        <ProfileStat
          icon={<ReceiptText size={20} />}
          label="Total Fees"
          value={formatCurrency(client.total_fees)}
          helper="Billed to client"
        />
        <ProfileStat
          icon={<WalletCards size={20} />}
          label="Total Paid"
          value={formatCurrency(client.total_paid)}
          helper="Payments received"
        />
        <ProfileStat
          icon={<BadgeDollarSign size={20} />}
          label="Outstanding"
          value={formatCurrency(client.outstanding_balance)}
          helper="Current balance"
          emphasis
        />
      </section>

      <section className="client-profile-tabs" aria-label="Client profile sections">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={activeTab === tab.id ? 'active' : ''}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </section>

      <section className="client-tab-panel">
        {activeTab === 'overview' && (
          <OverviewTab
            client={client}
            displayAddress={displayAddress}
          />
        )}

        {activeTab === 'cases' && (
          <ModulePlaceholder
            icon={<FolderKanban size={24} />}
            title="Client cases"
            description={`${formatNumber(client.total_cases)} linked cases, including ${formatNumber(client.active_cases)} active and ${formatNumber(client.closed_cases)} closed matters.`}
            actionLabel="Open Cases Module"
            actionTo={`/cases?clientId=${client.id}`}
          />
        )}

        {activeTab === 'hearings' && (
          <ModulePlaceholder
            icon={<CalendarDays size={24} />}
            title="Client hearings"
            description={`${formatNumber(client.total_hearings)} hearings are currently associated with this client.`}
            actionLabel="Open Hearings Module"
            actionTo={`/hearings?clientId=${client.id}`}
          />
        )}

        {activeTab === 'documents' && (
          <ModulePlaceholder
            icon={<FileText size={24} />}
            title="Client documents"
            description={`${formatNumber(client.total_documents)} documents are currently recorded for this client.`}
            actionLabel="Open Documents Module"
            actionTo={`/documents?clientId=${client.id}`}
          />
        )}

        {activeTab === 'invoices' && (
          <ModulePlaceholder
            icon={<ReceiptText size={24} />}
            title="Invoices"
            description={`Total fees currently recorded: ${formatCurrency(client.total_fees)}.`}
            actionLabel="Open Payments Module"
            actionTo={`/payments?clientId=${client.id}`}
          />
        )}

        {activeTab === 'payments' && (
          <ModulePlaceholder
            icon={<WalletCards size={24} />}
            title="Payments"
            description={`${formatCurrency(client.total_paid)} has been received. Current outstanding balance is ${formatCurrency(client.outstanding_balance)}.`}
            actionLabel="Open Payments Module"
            actionTo={`/payments?clientId=${client.id}`}
          />
        )}

        {activeTab === 'timeline' && (
          <TimelineTab client={client} />
        )}

        {activeTab === 'notes' && (
          <NotesTab notes={client.notes} />
        )}
      </section>
    </div>
  );
}

function OverviewTab({
  client,
  displayAddress,
}: {
  client: ClientOverview;
  displayAddress: string;
}) {
  return (
    <div className="client-overview-grid">
      <article className="client-profile-card">
        <div className="client-profile-card-heading">
          <CircleUserRound size={20} />
          <h3>Contact Information</h3>
        </div>

        <DetailRow
          icon={<Phone size={16} />}
          label="Primary phone"
          value={client.phone}
        />
        <DetailRow
          icon={<MessageCircle size={16} />}
          label="WhatsApp"
          value={client.whatsapp}
        />
        <DetailRow
          icon={<Mail size={16} />}
          label="Primary email"
          value={client.email}
        />
        <DetailRow
          icon={<Mail size={16} />}
          label="Secondary email"
          value={client.secondary_email}
        />
        <DetailRow
          icon={<MapPin size={16} />}
          label="Address"
          value={displayAddress}
        />
      </article>

      <article className="client-profile-card">
        <div className="client-profile-card-heading">
          <UserRound size={20} />
          <h3>Identity & Profile</h3>
        </div>

        <DetailRow
          label="Client type"
          value={formatLabel(client.client_type)}
        />
        <DetailRow
          label="Nationality"
          value={client.nationality}
        />
        <DetailRow
          label="Emirates ID"
          value={client.emirates_id}
        />
        <DetailRow
          label="Passport number"
          value={client.passport_number}
        />
        <DetailRow
          label="Preferred language"
          value={client.preferred_language}
        />
      </article>

      <article className="client-profile-card">
        <div className="client-profile-card-heading">
          <Building2 size={20} />
          <h3>Company Details</h3>
        </div>

        <DetailRow
          label="Company name"
          value={client.company_name}
        />
        <DetailRow
          label="Contact person"
          value={client.contact_person}
        />
        <DetailRow
          label="Trade licence"
          value={client.trade_license_number}
        />
        <DetailRow
          label="VAT number"
          value={client.vat_number}
        />
        <DetailRow
          label="Source"
          value={client.source}
        />
      </article>

      <article className="client-profile-card">
        <div className="client-profile-card-heading">
          <CalendarDays size={20} />
          <h3>Account Information</h3>
        </div>

        <DetailRow
          label="Client since"
          value={formatOptionalDate(
            client.client_since ?? client.created_at,
          )}
        />
        <DetailRow
          label="Next follow-up"
          value={formatOptionalDateTime(client.next_follow_up_at)}
        />
        <DetailRow
          label="Preferred contact"
          value={client.preferred_contact_method}
        />
        <DetailRow
          label="Imported from"
          value={client.imported_from}
        />
        <DetailRow
          label="Last updated"
          value={formatOptionalDate(client.updated_at)}
        />
      </article>
    </div>
  );
}

function TimelineTab({ client }: { client: ClientOverview }) {
  const entries = [
    {
      title: 'Client profile created',
      date: client.created_at,
      detail: `${client.full_name} was added to the SHAB client database.`,
    },
    {
      title: 'Profile last updated',
      date: client.updated_at,
      detail: 'The client record was last modified.',
    },
    client.imported_at
      ? {
          title: 'Client data imported',
          date: client.imported_at,
          detail: `Imported from ${client.imported_from ?? 'an external source'}.`,
        }
      : null,
  ].filter(
    (
      entry,
    ): entry is {
      title: string;
      date: string;
      detail: string;
    } => Boolean(entry),
  );

  return (
    <article className="client-profile-card client-timeline-card">
      <div className="client-profile-card-heading">
        <CalendarDays size={20} />
        <h3>Activity Timeline</h3>
      </div>

      <div className="client-timeline">
        {entries.map((entry) => (
          <div className="client-timeline-entry" key={`${entry.title}-${entry.date}`}>
            <div className="client-timeline-marker" />
            <div>
              <strong>{entry.title}</strong>
              <span>{formatOptionalDateTime(entry.date)}</span>
              <p>{entry.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

function NotesTab({ notes }: { notes?: string | null }) {
  return (
    <article className="client-profile-card notes-card">
      <div className="client-profile-card-heading">
        <FileText size={20} />
        <h3>Internal Notes</h3>
      </div>

      <p className="client-notes-content">
        {notes?.trim() || 'No internal notes have been added for this client.'}
      </p>
    </article>
  );
}

function ModulePlaceholder({
  icon,
  title,
  description,
  actionLabel,
  actionTo,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  actionTo: string;
}) {
  return (
    <div className="client-module-placeholder">
      <div className="client-module-placeholder-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      <Link className="secondary-action-button" to={actionTo}>
        {actionLabel}
      </Link>
    </div>
  );
}

function ProfileStat({
  icon,
  label,
  value,
  helper,
  emphasis = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  helper: string;
  emphasis?: boolean;
}) {
  return (
    <article
      className={[
        'client-profile-stat',
        emphasis ? 'emphasis' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="client-profile-stat-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{helper}</small>
      </div>
    </article>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value?: string | null;
}) {
  return (
    <div className="client-detail-row">
      <div className="client-detail-label">
        {icon}
        <span>{label}</span>
      </div>
      <strong>{value?.trim() || 'Not provided'}</strong>
    </div>
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

function formatNumber(value?: number | null): string {
  return new Intl.NumberFormat('en-AE').format(Number(value ?? 0));
}

function formatCurrency(value?: number | string | null): string {
  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency: 'AED',
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

function formatOptionalDate(value?: string | null): string {
  if (!value) {
    return 'Not provided';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Not provided';
  }

  return new Intl.DateTimeFormat('en-AE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatOptionalDateTime(value?: string | null): string {
  if (!value) {
    return 'Not provided';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Not provided';
  }

  return new Intl.DateTimeFormat('en-AE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}