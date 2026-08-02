import {
  AlertTriangle,
  ArrowLeft,
  BadgeDollarSign,
  Building2,
  CalendarDays,
  CircleUserRound,
  Clock3,
  ClipboardList,
  Download,
  ExternalLink,
  FileText,
  FolderKanban,
  Gavel,
  Mail,
  MapPin,
  MapPinned,
  MessageCircle,
  Phone,
  Plus,
  ReceiptText,
  Scale,
  ShieldAlert,
  Star,
  UserRound,
  WalletCards,
} from 'lucide-react';

import type {
  ReactNode,
} from 'react';
import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Link,
  useNavigate,
  useParams,
} from 'react-router-dom';

import {
  getClientById,
  type ClientOverview,
} from '../services/clientService';

import {
  getCases,
} from '../services/caseService';

import {
  getHearingsByClient,
  type ClientHearing,
} from '../services/hearingService';

import {
  getDocumentsByClient,
  openDocument,
  downloadDocument,
} from '../services/documentService';

import {
  getTasksByClient,
  getStaffOptions,
  type StaffOption,
} from '../services/taskService';
import type { Task } from '../types/task';
import type { DocumentWithRelations } from '../types/document';

import {
  getInvoices,
} from '../services/invoiceService';

import {
  getPayments,
} from '../services/paymentService';

import type {
  Invoice,
} from '../types/invoice';

import type {
  Payment,
} from '../types/payment';

import type {
  CaseWithRelations,
} from '../types/case';

import './ClientDetails.css';

type ClientTab =
  | 'overview'
  | 'cases'
  | 'hearings'
  | 'tasks'
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
  { id: 'tasks', label: 'Tasks' },
  { id: 'documents', label: 'Documents' },
  { id: 'invoices', label: 'Invoices' },
  { id: 'payments', label: 'Payments' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'notes', label: 'Notes' },
];

export function ClientDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [client, setClient] =
    useState<ClientOverview | null>(null);

  const [activeTab, setActiveTab] =
    useState<ClientTab>('overview');

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError('Client ID is missing.');
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadClient(
      clientId: string,
    ) {
      setLoading(true);
      setError(null);

      try {
        const data =
          await getClientById(
            clientId,
          );

        if (cancelled) {
          return;
        }

        if (!data) {
          setError(
            'Client not found.',
          );
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

  const displayAddress =
    useMemo(() => {
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

      return (
        structuredAddress ||
        client.address ||
        'Not provided'
      );
    }, [client]);

  if (loading) {
    return (
      <div className="client-details-page page-container">
        <div className="details-loading">
          <div className="details-loading-spinner" />

          <strong>
            Loading client profile…
          </strong>

          <span>
            Retrieving the latest client and matter information.
          </span>
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
            <strong>
              Unable to open client profile
            </strong>

            <span>
              {error ??
                'Client not found.'}
            </span>
          </div>
        </div>

        <button
          type="button"
          className="secondary-action-button"
          onClick={() =>
            navigate('/clients')
          }
        >
          <ArrowLeft size={17} />
          Back to Clients
        </button>
      </div>
    );
  }

  const isVip = Boolean(
    client.is_vip ??
      client.vip,
  );

  const riskLevel =
    client.risk_level ??
    'low';

  return (
    <div className="client-details-page page-container">
      <section className="client-profile-hero">
        <div className="client-profile-identity">
          <div className="client-profile-avatar">
            {getInitials(
              client.full_name,
            )}
          </div>

          <div>
            <div className="client-profile-code-line">
              <span className="client-profile-code">
                {client.client_code ??
                  'Client code pending'}
              </span>

              {isVip && (
                <span className="client-vip-badge">
                  <Star
                    size={14}
                    fill="currentColor"
                  />
                  VIP Client
                </span>
              )}

              <span
                className={`status-badge ${client.status}`}
              >
                {formatLabel(
                  client.status,
                )}
              </span>

              <span
                className={`risk-badge ${riskLevel}`}
              >
                {riskLevel !==
                  'low' && (
                  <ShieldAlert
                    size={14}
                  />
                )}

                {formatLabel(
                  riskLevel,
                )}{' '}
                Risk
              </span>
            </div>

            <h2>
              {client.full_name}
            </h2>

            <p>
              {client.company_name
                ? client.company_name
                : formatLabel(
                    client.client_type,
                  )}

              {client.nationality
                ? ` · ${client.nationality}`
                : ''}
            </p>
          </div>
        </div>

        <div className="client-profile-actions">
          <button
            type="button"
            className="secondary-action-button"
            onClick={() =>
              navigate('/clients')
            }
          >
            <ArrowLeft size={17} />
            Back
          </button>

          <Link
            className="secondary-action-button"
            to={`/cases?clientId=${client.id}`}
          >
            <FolderKanban
              size={17}
            />
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
          icon={
            <FolderKanban size={20} />
          }
          label="Total Cases"
          value={formatNumber(
            client.total_cases,
          )}
          helper={`${formatNumber(
            client.active_cases,
          )} active`}
        />

        <ProfileStat
          icon={
            <CalendarDays size={20} />
          }
          label="Hearings"
          value={formatNumber(
            client.total_hearings,
          )}
          helper="All recorded hearings"
        />

        <ProfileStat
          icon={<FileText size={20} />}
          label="Documents"
          value={formatNumber(
            client.total_documents,
          )}
          helper="Files on record"
        />

        <ProfileStat
          icon={
            <ReceiptText size={20} />
          }
          label="Total Fees"
          value={formatCurrency(
            client.total_fees,
          )}
          helper="Billed to client"
        />

        <ProfileStat
          icon={
            <WalletCards size={20} />
          }
          label="Total Paid"
          value={formatCurrency(
            client.total_paid,
          )}
          helper="Payments received"
        />

        <ProfileStat
          icon={
            <BadgeDollarSign
              size={20}
            />
          }
          label="Outstanding"
          value={formatCurrency(
            client.outstanding_balance,
          )}
          helper="Current balance"
          emphasis
        />
      </section>

      <section
        className="client-profile-tabs"
        aria-label="Client profile sections"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={
              activeTab === tab.id
                ? 'active'
                : ''
            }
            onClick={() =>
              setActiveTab(
                tab.id,
              )
            }
          >
            {tab.label}
          </button>
        ))}
      </section>

      <section className="client-tab-panel">
        {activeTab ===
          'overview' && (
          <OverviewTab
            client={client}
            displayAddress={
              displayAddress
            }
          />
        )}

        {activeTab === 'cases' && (
          <ClientCasesTab
            clientId={client.id}
          />
        )}

        {activeTab ===
          'hearings' && (
          <ClientHearingsTab
            clientId={client.id}
          />
        )}

        {activeTab === 'tasks' && (
          <ClientTasksTab
            clientId={client.id}
          />
        )}

        {activeTab === 'documents' && (
          <ClientDocumentsTab
            clientId={client.id}
          />
        )}

        {activeTab === 'invoices' && (
          <ClientInvoicesTab
            clientId={client.id}
          />
        )}

        {activeTab ===
          'payments' && (
          <ClientPaymentsTab
            clientId={client.id}
          />
        )}

        {activeTab ===
          'timeline' && (
          <TimelineTab
            client={client}
          />
        )}

        {activeTab ===
          'notes' && (
          <NotesTab
            notes={
              client.notes
            }
          />
        )}
      </section>
    </div>
  );
}

function ClientCasesTab({
  clientId,
}: {
  clientId: string;
}) {
  const [cases, setCases] =
    useState<
      CaseWithRelations[]
    >([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(
      null,
    );

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const result =
          await getCases({
            clientId,
            page: 1,
            pageSize: 20,
            sortBy:
              'created_at',
            sortOrder:
              'desc',
          });

        if (active) {
          setCases(
            result.data,
          );
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Unable to load client cases.',
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [clientId]);

  if (loading) {
    return (
      <div className="client-module-placeholder">
        <FolderKanban
          size={24}
        />

        <h3>
          Loading client cases…
        </h3>
      </div>
    );
  }

  if (error) {
    return (
      <div className="client-module-placeholder">
        <ShieldAlert
          size={24}
        />

        <h3>
          Unable to load cases
        </h3>

        <p>
          {error}
        </p>
      </div>
    );
  }

  if (cases.length === 0) {
    return (
      <div className="client-module-placeholder">
        <FolderKanban
          size={24}
        />

        <h3>
          No cases yet
        </h3>

        <p>
          This client does not have any active or historical matters recorded.
        </p>

        <Link
          className="primary-action-button"
          to={`/cases/new?clientId=${clientId}`}
        >
          <Plus size={17} />
          Create First Case
        </Link>
      </div>
    );
  }

  return (
    <article className="client-profile-card">
      <div className="client-profile-card-heading client-cases-heading">
        <div>
          <FolderKanban
            size={20}
          />

          <h3>
            Client Cases
          </h3>
        </div>

        <Link
          className="secondary-action-button"
          to={`/cases?clientId=${clientId}`}
        >
          View All
        </Link>
      </div>

      <div className="client-cases-table-wrap">
        <table className="client-cases-table">
          <thead>
            <tr>
              <th>Matter</th>
              <th>Court</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Next Hearing</th>
              <th>Lawyer</th>
              <th>Outstanding</th>
              <th />
            </tr>
          </thead>

          <tbody>
            {cases.map(
              (caseItem) => (
                <tr
                  key={
                    caseItem.id
                  }
                >
                  <td>
                    <div className="client-case-matter">
                      <Link
                        to={`/cases/${caseItem.id}`}
                      >
                        {caseItem.case_number}
                      </Link>

                      <span>
                        {caseItem.case_type}
                      </span>

                      {caseItem.requires_urgent_action && (
                        <small className="client-case-urgent">
                          <AlertTriangle
                            size={12}
                          />
                          Urgent
                        </small>
                      )}
                    </div>
                  </td>

                  <td>
                    {caseItem.court ||
                      'Not set'}
                  </td>

                  <td>
                    <span
                      className={`case-inline-status ${normalizeClassName(
                        caseItem.status,
                      )}`}
                    >
                      {formatLabel(
                        caseItem.status,
                      )}
                    </span>
                  </td>

                  <td>
                    <span
                      className={`case-inline-priority ${normalizeClassName(
                        caseItem.priority,
                      )}`}
                    >
                      {formatLabel(
                        caseItem.priority,
                      )}
                    </span>
                  </td>

                  <td>
                    {formatOptionalDate(
                      caseItem.next_hearing_at,
                    )}
                  </td>

                  <td>
                    {caseItem.responsible_lawyer?.full_name ??
                      caseItem.assigned_staff?.full_name ??
                      caseItem.assigned_lawyer ??
                      'Unassigned'}
                  </td>

                  <td>
                    <strong>
                      {formatCurrency(
                        caseItem.outstanding_balance,
                      )}
                    </strong>
                  </td>

                  <td>
                    <Link
                      className="action-link"
                      to={`/cases/${caseItem.id}`}
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function ClientHearingsTab({
  clientId,
}: {
  clientId: string;
}) {
  const [hearings, setHearings] =
    useState<ClientHearing[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const result =
          await getHearingsByClient(
            clientId,
          );

        if (active) {
          setHearings(result);
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Unable to load hearings.',
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [clientId]);

  if (loading) {
    return (
      <div className="client-module-placeholder">
        <CalendarDays
          size={24}
        />

        <h3>
          Loading hearings…
        </h3>
      </div>
    );
  }

  if (error) {
    return (
      <div className="client-module-placeholder">
        <ShieldAlert
          size={24}
        />

        <h3>
          Unable to load hearings
        </h3>

        <p>{error}</p>
      </div>
    );
  }

  if (hearings.length === 0) {
    return (
      <div className="client-module-placeholder">
        <Gavel size={24} />

        <h3>
          No hearings yet
        </h3>

        <p>
          No court hearings are currently linked to this client.
        </p>

        <Link
          className="secondary-action-button"
          to={`/hearings?clientId=${clientId}`}
        >
          Open Hearings Module
        </Link>
      </div>
    );
  }

  return (
    <article className="client-profile-card">
      <div className="client-profile-card-heading client-cases-heading">
        <div>
          <Gavel size={20} />

          <h3>
            Client Hearings
          </h3>
        </div>

        <Link
          className="secondary-action-button"
          to={`/hearings?clientId=${clientId}`}
        >
          View All
        </Link>
      </div>

      <div className="client-hearings-list">
        {hearings.map(
          (hearing) => (
            <article
              key={
                hearing.id
              }
              className="client-hearing-item"
            >
              <div className="client-hearing-date">
                <strong>
                  {formatOptionalDate(
                    hearing.hearing_at,
                  )}
                </strong>

                <span>
                  {formatTimeOnly(
                    hearing.hearing_at,
                  )}
                </span>
              </div>

              <div className="client-hearing-content">
                <div className="client-hearing-title">
                  <Scale
                    size={15}
                  />

                  <strong>
                    {hearing.title ||
                      hearing.case_number ||
                      hearing.case_type ||
                      'Court Hearing'}
                  </strong>
                </div>

                <div className="client-hearing-meta">
                  {hearing.case_number && (
                    <span>
                      <FolderKanban
                        size={13}
                      />
                      {hearing.case_number}
                    </span>
                  )}

                  {hearing.court && (
                    <span>
                      <MapPinned
                        size={13}
                      />
                      {hearing.court}
                    </span>
                  )}

                  {hearing.courtroom && (
                    <span>
                      <Gavel
                        size={13}
                      />
                      {hearing.courtroom}
                    </span>
                  )}

                  {hearing.assigned_staff_name && (
                    <span>
                      <UserRound
                        size={13}
                      />
                      {hearing.assigned_staff_name}
                    </span>
                  )}

                  {hearing.hearing_type && (
                    <span>
                      <Clock3
                        size={13}
                      />
                      {formatLabel(
                        hearing.hearing_type,
                      )}
                    </span>
                  )}
                </div>

                {hearing.outcome && (
                  <p className="client-hearing-outcome">
                    <strong>
                      Outcome:
                    </strong>{' '}
                    {hearing.outcome}
                  </p>
                )}
              </div>

              <span
                className={`case-inline-status ${normalizeClassName(
                  hearing.status ||
                    'scheduled',
                )}`}
              >
                {formatLabel(
                  hearing.status ||
                    'scheduled',
                )}
              </span>
            </article>
          ),
        )}
      </div>
    </article>
  );
}


function ClientTasksTab({
  clientId,
}: {
  clientId: string;
}) {
  const [tasks, setTasks] =
    useState<Task[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [staffMap, setStaffMap] =
    useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const [taskRows, staffOptions] =
          await Promise.all([
            getTasksByClient(clientId),
            getStaffOptions(),
          ]);

        if (!active) {
          return;
        }

        setTasks(taskRows);
        setStaffMap(
          staffOptions.reduce(
            (accumulator, member) => {
              accumulator[member.id] = member.name;
              return accumulator;
            },
            {} as Record<string, string>,
          ),
        );
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load client tasks.',
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [clientId]);

  if (loading) {
    return (
      <div className="client-module-placeholder">
        <ClipboardList size={24} />
        <h3>Loading tasks…</h3>
      </div>
    );
  }

  if (error) {
    return (
      <div className="client-module-placeholder">
        <ShieldAlert size={24} />
        <h3>Unable to load tasks</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="client-module-placeholder">
        <ClipboardList size={24} />

        <h3>No tasks found</h3>

        <p>
          This client does not have any tasks yet.
        </p>

        <Link
          className="primary-action-button"
          to={`/tasks?clientId=${clientId}&create=1`}
        >
          Add Task
        </Link>
      </div>
    );
  }

  return (
    <article className="client-profile-card">
      <div className="client-profile-card-heading client-cases-heading">
        <div>
          <ClipboardList size={20} />
          <h3>Client Tasks</h3>
        </div>

        <Link
          className="secondary-action-button"
          to={`/tasks?clientId=${clientId}`}
        >
          View in Tasks
        </Link>
      </div>

      <div className="client-cases-table-wrap">
        <table className="client-cases-table">
          <thead>
            <tr>
              <th>Task</th>
              <th>Assigned To</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Due Date</th>
            </tr>
          </thead>

          <tbody>
            {tasks.map((task) => (
              <tr key={task.id}>
                <td>
                  <strong>{task.title}</strong>
                </td>
                <td>
                  {task.assigned_staff_id
                    ? staffMap[task.assigned_staff_id] ?? 'Unassigned'
                    : 'Unassigned'}
                </td>
                <td>
                  <span
                    className={`case-inline-priority ${normalizeClassName(
                      task.priority,
                    )}`}
                  >
                    {task.priority}
                  </span>
                </td>
                <td>
                  <span
                    className={`case-inline-status ${normalizeClassName(
                      task.status,
                    )}`}
                  >
                    {task.status}
                  </span>
                </td>
                <td>
                  {formatOptionalDate(task.due_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function ClientInvoicesTab({
  clientId,
}: {
  clientId: string;
}) {
  const [invoices, setInvoices] =
    useState<Invoice[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const result =
          await getInvoices({
            clientId,
            page: 1,
            pageSize: 50,
          });

        if (active) {
          setInvoices(result.data);
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Unable to load invoices.',
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [clientId]);

  if (loading) {
    return (
      <div className="client-module-placeholder">
        <ReceiptText size={24} />
        <h3>Loading invoices…</h3>
      </div>
    );
  }

  if (error) {
    return (
      <div className="client-module-placeholder">
        <ShieldAlert size={24} />
        <h3>Unable to load invoices</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="client-module-placeholder">
        <ReceiptText size={24} />

        <h3>No invoices yet</h3>

        <p>
          This client does not have any invoices recorded.
        </p>

        <Link
          className="secondary-action-button"
          to={`/payments?clientId=${clientId}`}
        >
          Open Finance Module
        </Link>
      </div>
    );
  }

  return (
    <article className="client-profile-card">
      <div className="client-profile-card-heading client-cases-heading">
        <div>
          <ReceiptText size={20} />
          <h3>Client Invoices</h3>
        </div>

        <Link
          className="secondary-action-button"
          to={`/payments?clientId=${clientId}`}
        >
          Open Finance
        </Link>
      </div>

      <div className="client-cases-table-wrap">
        <table className="client-cases-table">
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Issue Date</th>
              <th>Due Date</th>
              <th>Status</th>
              <th>Total</th>
              <th>Paid</th>
              <th>Balance</th>
            </tr>
          </thead>

          <tbody>
            {invoices.map((invoice) => (
              <tr key={invoice.id}>
                <td>
                  <strong>
                    {invoice.invoice_number}
                  </strong>
                </td>

                <td>
                  {formatOptionalDate(
                    invoice.issue_date,
                  )}
                </td>

                <td>
                  {formatOptionalDate(
                    invoice.due_date,
                  )}
                </td>

                <td>
                  <span
                    className={`case-inline-status ${normalizeClassName(
                      invoice.status,
                    )}`}
                  >
                    {formatLabel(
                      invoice.status,
                    )}
                  </span>
                </td>

                <td>
                  {formatCurrency(
                    invoice.total_amount,
                  )}
                </td>

                <td>
                  {formatCurrency(
                    invoice.paid_amount,
                  )}
                </td>

                <td>
                  <strong>
                    {formatCurrency(
                      invoice.balance_amount,
                    )}
                  </strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function ClientPaymentsTab({
  clientId,
}: {
  clientId: string;
}) {
  const [payments, setPayments] =
    useState<Payment[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const result =
          await getPayments({
            clientId,
            page: 1,
            pageSize: 50,
          });

        if (active) {
          setPayments(result.data);
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Unable to load payments.',
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [clientId]);

  if (loading) {
    return (
      <div className="client-module-placeholder">
        <WalletCards size={24} />
        <h3>Loading payments…</h3>
      </div>
    );
  }

  if (error) {
    return (
      <div className="client-module-placeholder">
        <ShieldAlert size={24} />
        <h3>Unable to load payments</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div className="client-module-placeholder">
        <WalletCards size={24} />

        <h3>No payments yet</h3>

        <p>
          No payment records are currently linked to this client.
        </p>

        <Link
          className="secondary-action-button"
          to={`/payments?clientId=${clientId}`}
        >
          Open Finance Module
        </Link>
      </div>
    );
  }

  return (
    <article className="client-profile-card">
      <div className="client-profile-card-heading client-cases-heading">
        <div>
          <WalletCards size={20} />
          <h3>Client Payments</h3>
        </div>

        <Link
          className="secondary-action-button"
          to={`/payments?clientId=${clientId}`}
        >
          Open Finance
        </Link>
      </div>

      <div className="client-cases-table-wrap">
        <table className="client-cases-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Amount</th>
              <th>Method</th>
              <th>Reference</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            {payments.map((payment) => (
              <tr key={payment.id}>
                <td>
                  {formatOptionalDate(
                    payment.payment_date,
                  )}
                </td>

                <td>
                  <strong>
                    {formatCurrency(
                      payment.amount,
                    )}
                  </strong>
                </td>

                <td>
                  {payment.payment_method
                    ? formatLabel(
                        payment.payment_method,
                      )
                    : 'Not provided'}
                </td>

                <td>
                  {payment.reference_number ||
                    '—'}
                </td>

                <td>
                  <span
                    className={`case-inline-status ${normalizeClassName(
                      payment.status,
                    )}`}
                  >
                    {formatLabel(
                      payment.status,
                    )}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
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
          <CircleUserRound
            size={20}
          />

          <h3>
            Contact Information
          </h3>
        </div>

        <DetailRow
          icon={
            <Phone size={16} />
          }
          label="Primary phone"
          value={client.phone}
        />

        <DetailRow
          icon={
            <MessageCircle
              size={16}
            />
          }
          label="WhatsApp"
          value={client.whatsapp}
        />

        <DetailRow
          icon={
            <Mail size={16} />
          }
          label="Primary email"
          value={client.email}
        />

        <DetailRow
          icon={
            <Mail size={16} />
          }
          label="Secondary email"
          value={
            client.secondary_email
          }
        />

        <DetailRow
          icon={
            <MapPin size={16} />
          }
          label="Address"
          value={
            displayAddress
          }
        />
      </article>

      <article className="client-profile-card">
        <div className="client-profile-card-heading">
          <UserRound
            size={20}
          />

          <h3>
            Identity & Profile
          </h3>
        </div>

        <DetailRow
          label="Client type"
          value={formatLabel(
            client.client_type,
          )}
        />

        <DetailRow
          label="Nationality"
          value={
            client.nationality
          }
        />

        <DetailRow
          label="Emirates ID"
          value={
            client.emirates_id
          }
        />

        <DetailRow
          label="Passport number"
          value={
            client.passport_number
          }
        />

        <DetailRow
          label="Preferred language"
          value={
            client.preferred_language
          }
        />
      </article>

      <article className="client-profile-card">
        <div className="client-profile-card-heading">
          <Building2
            size={20}
          />

          <h3>
            Company Details
          </h3>
        </div>

        <DetailRow
          label="Company name"
          value={
            client.company_name
          }
        />

        <DetailRow
          label="Contact person"
          value={
            client.contact_person
          }
        />

        <DetailRow
          label="Trade licence"
          value={
            client.trade_license_number
          }
        />

        <DetailRow
          label="VAT number"
          value={
            client.vat_number
          }
        />

        <DetailRow
          label="Source"
          value={
            client.source
          }
        />
      </article>

      <article className="client-profile-card">
        <div className="client-profile-card-heading">
          <CalendarDays
            size={20}
          />

          <h3>
            Account Information
          </h3>
        </div>

        <DetailRow
          label="Client since"
          value={formatOptionalDate(
            client.client_since ??
              client.created_at,
          )}
        />

        <DetailRow
          label="Next follow-up"
          value={formatOptionalDateTime(
            client.next_follow_up_at,
          )}
        />

        <DetailRow
          label="Preferred contact"
          value={
            client.preferred_contact_method
          }
        />

        <DetailRow
          label="Imported from"
          value={
            client.imported_from
          }
        />

        <DetailRow
          label="Last updated"
          value={formatOptionalDate(
            client.updated_at,
          )}
        />
      </article>
    </div>
  );
}

function TimelineTab({
  client,
}: {
  client: ClientOverview;
}) {
  const entries = [
    {
      title:
        'Client profile created',
      date:
        client.created_at,
      detail: `${client.full_name} was added to the SHAB client database.`,
    },
    {
      title:
        'Profile last updated',
      date:
        client.updated_at,
      detail:
        'The client record was last modified.',
    },
    client.imported_at
      ? {
          title:
            'Client data imported',
          date:
            client.imported_at,
          detail: `Imported from ${
            client.imported_from ??
            'an external source'
          }.`,
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
        <CalendarDays
          size={20}
        />

        <h3>
          Activity Timeline
        </h3>
      </div>

      <div className="client-timeline">
        {entries.map(
          (entry) => (
            <div
              className="client-timeline-entry"
              key={`${entry.title}-${entry.date}`}
            >
              <div className="client-timeline-marker" />

              <div>
                <strong>
                  {entry.title}
                </strong>

                <span>
                  {formatOptionalDateTime(
                    entry.date,
                  )}
                </span>

                <p>
                  {entry.detail}
                </p>
              </div>
            </div>
          ),
        )}
      </div>
    </article>
  );
}

function NotesTab({
  notes,
}: {
  notes?: string | null;
}) {
  return (
    <article className="client-profile-card notes-card">
      <div className="client-profile-card-heading">
        <FileText size={20} />

        <h3>
          Internal Notes
        </h3>
      </div>

      <p className="client-notes-content">
        {notes?.trim() ||
          'No internal notes have been added for this client.'}
      </p>
    </article>
  );
}

function ClientDocumentsTab({
  clientId,
}: {
  clientId: string;
}) {
  const [documents, setDocuments] = useState<
    DocumentWithRelations[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadDocuments() {
      try {
        setLoading(true);
        setError(null);

        const rows = await getDocumentsByClient(
          clientId,
        );

        if (active) {
          setDocuments(rows);
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Unable to load client documents.',
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadDocuments();

    return () => {
      active = false;
    };
  }, [clientId]);

  return (
    <article className="client-profile-card">
      <div className="client-profile-card-heading client-documents-heading">
        <div>
          <FileText size={20} />

          <h3>Client documents</h3>
        </div>

        <div className="client-documents-actions">
          <Link
            className="secondary-action-button"
            to={`/documents?clientId=${clientId}`}
          >
            View all
          </Link>

          <Link
            className="primary-action-button"
            to={`/documents?clientId=${clientId}&upload=1`}
          >
            Upload document
          </Link>
        </div>
      </div>

      <section className="client-documents-summary">
        <div>
          <span>Total documents</span>
          <strong>{documents.length}</strong>
        </div>

        <div>
          <span>Confidential</span>
          <strong>
            {documents.filter(
              (document) =>
                document.is_confidential,
            ).length}
          </strong>
        </div>

        <div>
          <span>Standard</span>
          <strong>
            {documents.filter(
              (document) =>
                !document.is_confidential,
            ).length}
          </strong>
        </div>

        <div>
          <span>Latest upload</span>
          <strong>
            {documents.length > 0
              ? formatOptionalDateTime(
                  documents[0]
                    .created_at,
                )
              : 'No uploads yet'}
          </strong>
        </div>
      </section>

      {loading ? (
        <div className="client-module-placeholder">
          <FileText size={24} />

          <h3>
            Loading client documents…
          </h3>
        </div>
      ) : error ? (
        <div className="client-module-placeholder">
          <ShieldAlert size={24} />

          <h3>
            Unable to load documents
          </h3>

          <p>{error}</p>
        </div>
      ) : documents.length === 0 ? (
        <div className="client-module-placeholder">
          <FileText size={24} />

          <h3>
            No documents found
          </h3>

          <p>
            This client has no files recorded yet. Upload documents to store case and client evidence centrally.
          </p>

          <Link
            className="primary-action-button"
            to={`/documents?clientId=${clientId}&upload=1`}
          >
            Upload document
          </Link>
        </div>
      ) : (
        <div className="client-documents-table-wrap">
          <table className="client-cases-table client-documents-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Uploaded</th>
                <th>Privacy</th>
                <th>Uploaded by</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {documents.map((document) => (
                <tr key={document.id}>
                  <td>{document.name}</td>
                  <td>
                    {document.document_type ||
                      document.mime_type ||
                      'File'}
                  </td>
                  <td>
                    {formatOptionalDateTime(
                      document.created_at,
                    )}
                  </td>
                  <td>
                    <span
                      className={`case-document-privacy-badge ${
                        document.is_confidential
                          ? 'confidential'
                          : 'standard'
                      }`}
                    >
                      {document.is_confidential
                        ? 'Confidential'
                        : 'Standard'}
                    </span>
                  </td>
                  <td>
                    {document.uploaded_by_staff
                      ?.full_name ??
                      document.uploaded_by ??
                      'Unknown'}
                  </td>
                  <td>
                    <div className="client-document-actions">
                      <Link
                        className="secondary-action-button"
                        to={`/documents?clientId=${clientId}&documentId=${document.id}`}
                      >
                        Details
                      </Link>

                      <button
                        type="button"
                        className="secondary-action-button"
                        onClick={async () => {
                          setActionError(null);
                          setActionId(document.id);

                          try {
                            await openDocument(document);
                          } catch (actionError) {
                            setActionError(
                              actionError instanceof Error
                                ? actionError.message
                                : 'Unable to open document.',
                            );
                          } finally {
                            setActionId(null);
                          }
                        }}
                        disabled={actionId === document.id}
                      >
                        Open
                      </button>

                      <button
                        type="button"
                        className="secondary-action-button"
                        onClick={async () => {
                          setActionError(null);
                          setActionId(document.id);

                          try {
                            await downloadDocument(document);
                          } catch (actionError) {
                            setActionError(
                              actionError instanceof Error
                                ? actionError.message
                                : 'Unable to download document.',
                            );
                          } finally {
                            setActionId(null);
                          }
                        }}
                        disabled={actionId === document.id}
                      >
                        Download
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {actionError && (
        <div className="client-module-placeholder">
          <ShieldAlert size={24} />

          <h3>Unable to complete document action</h3>

          <p>{actionError}</p>
        </div>
      )}
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
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  actionTo: string;
}) {
  return (
    <div className="client-module-placeholder">
      <div className="client-module-placeholder-icon">
        {icon}
      </div>

      <h3>
        {title}
      </h3>

      <p>
        {description}
      </p>

      <Link
        className="secondary-action-button"
        to={actionTo}
      >
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
        emphasis
          ? 'emphasis'
          : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="client-profile-stat-icon">
        {icon}
      </div>

      <div>
        <span>
          {label}
        </span>

        <strong>
          {value}
        </strong>

        <small>
          {helper}
        </small>
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

        <span>
          {label}
        </span>
      </div>

      <strong>
        {value?.trim() ||
          'Not provided'}
      </strong>
    </div>
  );
}

function getInitials(
  name: string,
): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(
      (part) =>
        part[0]?.toUpperCase(),
    )
    .join('');

  return initials || 'CL';
}

function formatLabel(
  value: string,
): string {
  return value
    .replace(/_/g, ' ')
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase(),
    );
}

function normalizeClassName(
  value: string,
): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/_/g, '-');
}

function formatNumber(
  value?: number | null,
): string {
  return new Intl.NumberFormat(
    'en-AE',
  ).format(
    Number(value ?? 0),
  );
}

function formatCurrency(
  value?: number | string | null,
): string {
  return new Intl.NumberFormat(
    'en-AE',
    {
      style: 'currency',
      currency: 'AED',
      maximumFractionDigits: 2,
    },
  ).format(
    Number(value ?? 0),
  );
}

function formatOptionalDate(
  value?: string | null,
): string {
  if (!value) {
    return 'Not provided';
  }

  const date = new Date(
    value,
  );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return 'Not provided';
  }

  return new Intl.DateTimeFormat(
    'en-AE',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    },
  ).format(date);
}

function formatOptionalDateTime(
  value?: string | null,
): string {
  if (!value) {
    return 'Not provided';
  }

  const date = new Date(
    value,
  );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return 'Not provided';
  }

  return new Intl.DateTimeFormat(
    'en-AE',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    },
  ).format(date);
}

function formatTimeOnly(
  value?: string | null,
): string {
  if (!value) {
    return 'Time not set';
  }

  const date = new Date(
    value,
  );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return 'Time not set';
  }

  return new Intl.DateTimeFormat(
    'en-GB',
    {
      hour: '2-digit',
      minute: '2-digit',
    },
  ).format(date);
}