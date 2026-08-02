import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CircleDollarSign,
  Clock3,
  FileWarning,
  FilterX,
  FolderKanban,
  Gavel,
  Landmark,
  Plus,
  Scale,
  Search,
  ShieldAlert,
  UserRound,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  Link,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';

import {
  getCaseDashboardStats,
  getCases,
  getClientOptions,
  type CaseDashboardStats,
} from '../services/caseService';
import type {
  CasePriority,
  CaseRiskLevel,
  CaseStatus,
  CaseWithRelations,
} from '../types/case';
import './Cases.css';

const PAGE_SIZE = 12;

type StatusFilter =
  | 'all'
  | 'open'
  | 'pending'
  | 'in_court'
  | 'closed'
  | 'appeal';

type PriorityFilter =
  | 'all'
  | 'low'
  | 'medium'
  | 'high'
  | 'urgent';

type RiskFilter =
  | 'all'
  | 'low'
  | 'medium'
  | 'high'
  | 'critical';

type SortValue =
  | 'filing_date'
  | 'next_hearing_at'
  | 'priority'
  | 'status'
  | 'case_number'
  | 'matter_number'
  | 'updated_at';

const emptyStats: CaseDashboardStats = {
  total: 0,
  active: 0,
  inCourt: 0,
  appeals: 0,
  urgent: 0,
  upcomingHearings: 0,
  overdueActions: 0,
  totalClaimValue: 0,
  recoveredAmount: 0,
  outstandingBalance: 0,
};

const statusOptions: Array<{
  value: StatusFilter;
  label: string;
}> = [
  { value: 'all', label: 'All statuses' },
  { value: 'open', label: 'Open' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_court', label: 'In Court' },
  { value: 'closed', label: 'Closed' },
  { value: 'appeal', label: 'Appeal' },
];

const priorityOptions: Array<{
  value: PriorityFilter;
  label: string;
}> = [
  { value: 'all', label: 'All priorities' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const riskOptions: Array<{
  value: RiskFilter;
  label: string;
}> = [
  { value: 'all', label: 'All risk levels' },
  { value: 'low', label: 'Low Risk' },
  { value: 'medium', label: 'Medium Risk' },
  { value: 'high', label: 'High Risk' },
  { value: 'critical', label: 'Critical Risk' },
];

const sortOptions: Array<{
  value: SortValue;
  label: string;
}> = [
  { value: 'filing_date', label: 'Filing Date' },
  { value: 'next_hearing_at', label: 'Next Hearing' },
  { value: 'updated_at', label: 'Recently Updated' },
  { value: 'priority', label: 'Priority' },
  { value: 'status', label: 'Status' },
  { value: 'matter_number', label: 'Matter Number' },
  { value: 'case_number', label: 'Case Number' },
];

export function Cases() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const clientIdFromUrl = searchParams.get('clientId') ?? 'all';
  const assignedStaffIdFromUrl =
    searchParams.get('assignedStaffId') ?? 'all';

  const [cases, setCases] = useState<CaseWithRelations[]>([]);
  const [clients, setClients] = useState<Record<string, string>>({});
  const [stats, setStats] = useState<CaseDashboardStats>(emptyStats);

  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>('all');
  const [priorityFilter, setPriorityFilter] =
    useState<PriorityFilter>('all');
  const [riskFilter, setRiskFilter] =
    useState<RiskFilter>('all');
  const [clientFilter, setClientFilter] =
    useState(clientIdFromUrl);

  const [assignedStaffFilter, setAssignedStaffFilter] =
    useState(assignedStaffIdFromUrl);
  const [sortBy, setSortBy] =
    useState<SortValue>('filing_date');
  const [sortOrder, setSortOrder] =
    useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    setClientFilter(clientIdFromUrl);
    setAssignedStaffFilter(
      assignedStaffIdFromUrl,
    );
    setPage(1);
  }, [
    clientIdFromUrl,
    assignedStaffIdFromUrl,
  ]);

  const fetchOptions = useMemo(
    (): import('../types/case').CaseFilterOptions => ({
      search,
      status:
        statusFilter === 'all'
          ? 'all'
          : (statusFilter as CaseStatus),
      priority:
        priorityFilter === 'all'
          ? 'all'
          : (priorityFilter as CasePriority),
      riskLevel:
        riskFilter === 'all'
          ? 'all'
          : (riskFilter as CaseRiskLevel),
      clientId: clientFilter,
      assignedStaffId: assignedStaffFilter,
      sortBy,
      sortOrder,
      page,
      pageSize: PAGE_SIZE,
    }),
    [
      search,
      statusFilter,
      priorityFilter,
      riskFilter,
      clientFilter,
      assignedStaffFilter,
      sortBy,
      sortOrder,
      page,
    ],
  );

  const fetchCases = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [casesResult, clientOptions] = await Promise.all([
        getCases(fetchOptions),
        getClientOptions(),
      ]);

      setCases(casesResult.data);
      setTotalCount(casesResult.count);
      setClients(
        clientOptions.reduce<Record<string, string>>(
          (accumulator, client) => {
            accumulator[client.id] = client.full_name;
            return accumulator;
          },
          {},
        ),
      );
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : 'Unable to load matters.',
      );
    } finally {
      setLoading(false);
    }
  }, [fetchOptions]);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);

    try {
      const data = await getCaseDashboardStats(
        clientFilter === 'all' ? undefined : clientFilter,
      );
      setStats(data);
    } catch {
      setStats(emptyStats);
    } finally {
      setStatsLoading(false);
    }
  }, [clientFilter]);

  useEffect(() => {
    void fetchCases();
  }, [fetchCases]);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  const totalPages = Math.max(
    1,
    Math.ceil(totalCount / PAGE_SIZE),
  );

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const filtersAreActive =
    search.trim() !== '' ||
    statusFilter !== 'all' ||
    priorityFilter !== 'all' ||
    riskFilter !== 'all' ||
    clientFilter !== 'all';

  const selectedClientName =
    clientFilter === 'all'
      ? null
      : clients[clientFilter] ?? 'Selected client';

  const updateClientFilter = (value: string) => {
    setClientFilter(value);
    setPage(1);

    const nextParams = new URLSearchParams(searchParams);

    if (value === 'all') {
      nextParams.delete('clientId');
    } else {
      nextParams.set('clientId', value);
    }

    setSearchParams(nextParams, { replace: true });
  };

  const handleResetFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setPriorityFilter('all');
    setRiskFilter('all');
    setSortBy('filing_date');
    setSortOrder('desc');
    setPage(1);
    updateClientFilter('all');
  };

  return (
    <div className="cases-page page-container">
      <section className="page-heading cases-heading">
        <div>
          <p className="page-eyebrow">
            Legal matter management
          </p>
          <h2>Cases & Matters</h2>
          <p className="page-intro">
            Manage litigation, assignments, deadlines,
            hearings, financial exposure, and legal strategy
            from one central workspace.
          </p>
        </div>

        <button
          type="button"
          className="primary-action-button"
          onClick={() =>
            navigate(
              clientFilter === 'all'
                ? '/cases/new'
                : `/cases/new?clientId=${clientFilter}`,
            )
          }
        >
          <Plus size={18} />
          Add Matter
        </button>
      </section>

      {selectedClientName && (
        <section className="cases-client-context">
          <div>
            <UserRound size={18} />
            <span>
              Showing matters for
              <strong>{selectedClientName}</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={() => updateClientFilter('all')}
          >
            Clear client filter
          </button>
        </section>
      )}

      <section className="cases-summary-grid">
        <SummaryCard
          icon={<FolderKanban size={20} />}
          label="Total Matters"
          value={stats.total}
          helper="Current client scope"
          loading={statsLoading}
        />
        <SummaryCard
          icon={<Scale size={20} />}
          label="Active"
          value={stats.active}
          helper="Open and progressing"
          loading={statsLoading}
        />
        <SummaryCard
          icon={<Gavel size={20} />}
          label="In Court"
          value={stats.inCourt}
          helper="Active court matters"
          loading={statsLoading}
        />
        <SummaryCard
          icon={<Landmark size={20} />}
          label="Appeals"
          value={stats.appeals}
          helper="Under appeal"
          loading={statsLoading}
        />
        <SummaryCard
          icon={<AlertTriangle size={20} />}
          label="Urgent"
          value={stats.urgent}
          helper="Immediate attention"
          loading={statsLoading}
          tone="warning"
        />
        <SummaryCard
          icon={<CalendarClock size={20} />}
          label="Hearings in 30 Days"
          value={stats.upcomingHearings}
          helper="Upcoming schedule"
          loading={statsLoading}
        />
        <SummaryCard
          icon={<FileWarning size={20} />}
          label="Overdue Actions"
          value={stats.overdueActions}
          helper="Past-due next actions"
          loading={statsLoading}
          tone="danger"
        />
        <SummaryCard
          icon={<CircleDollarSign size={20} />}
          label="Outstanding"
          value={formatCurrency(stats.outstandingBalance)}
          helper="Matter balances"
          loading={statsLoading}
          tone="financial"
        />
      </section>

      <section className="cases-toolbar">
        <div className="cases-search">
          <Search size={18} />
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search matter, case number, court, opponent, lawyer or reference"
            aria-label="Search matters"
          />
        </div>

        <div className="cases-filters">
          <FilterField label="Status" id="case-status-filter">
            <select
              id="case-status-filter"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(
                  event.target.value as StatusFilter,
                );
                setPage(1);
              }}
            >
              {statusOptions.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Priority" id="case-priority-filter">
            <select
              id="case-priority-filter"
              value={priorityFilter}
              onChange={(event) => {
                setPriorityFilter(
                  event.target.value as PriorityFilter,
                );
                setPage(1);
              }}
            >
              {priorityOptions.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Risk" id="case-risk-filter">
            <select
              id="case-risk-filter"
              value={riskFilter}
              onChange={(event) => {
                setRiskFilter(
                  event.target.value as RiskFilter,
                );
                setPage(1);
              }}
            >
              {riskOptions.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Client" id="case-client-filter">
            <select
              id="case-client-filter"
              value={clientFilter}
              onChange={(event) =>
                updateClientFilter(event.target.value)
              }
            >
              <option value="all">All clients</option>
              {Object.entries(clients).map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Sort" id="case-sort-filter">
            <select
              id="case-sort-filter"
              value={sortBy}
              onChange={(event) => {
                setSortBy(event.target.value as SortValue);
                setPage(1);
              }}
            >
              {sortOptions.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Order" id="case-order-filter">
            <select
              id="case-order-filter"
              value={sortOrder}
              onChange={(event) => {
                setSortOrder(
                  event.target.value as 'asc' | 'desc',
                );
                setPage(1);
              }}
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </FilterField>

          <button
            type="button"
            className="secondary-action-button cases-reset-button"
            onClick={handleResetFilters}
            disabled={!filtersAreActive}
          >
            <FilterX size={17} />
            Reset
          </button>
        </div>
      </section>

      <section className="cases-status-row">
        <div>
          <strong>
            {filtersAreActive ? 'Filtered matters' : 'All matters'}
          </strong>
          <span>
            {totalCount}{' '}
            {totalCount === 1 ? 'result' : 'results'}
          </span>
        </div>
        <span>
          Page {page} of {totalPages}
        </span>
      </section>

      <section className="cases-grid">
        {loading ? (
          <CasesState
            title="Loading matters…"
            description="Retrieving the latest legal matter information."
          />
        ) : error ? (
          <CasesState
            title="Unable to load matters"
            description={error}
            error
          />
        ) : cases.length === 0 ? (
          <CasesState
            title="No matters found"
            description={
              filtersAreActive
                ? 'Adjust or reset the filters to see more results.'
                : 'Create the first legal matter to begin case management.'
            }
            action={
              filtersAreActive ? (
                <button
                  type="button"
                  className="secondary-action-button"
                  onClick={handleResetFilters}
                >
                  Reset Filters
                </button>
              ) : (
                <Link
                  className="primary-action-button"
                  to="/cases/new"
                >
                  <Plus size={17} />
                  Add Matter
                </Link>
              )
            }
          />
        ) : (
          cases.map((record) => (
            <CaseCard
              key={record.id}
              record={record}
              clientName={
                record.client?.full_name ??
                clients[record.client_id] ??
                'Unknown client'
              }
            />
          ))
        )}
      </section>

      {totalPages > 1 && (
        <section className="cases-pagination">
          <button
            type="button"
            onClick={() =>
              setPage((current) => Math.max(1, current - 1))
            }
            disabled={page <= 1}
          >
            Previous
          </button>

          <span>
            Page {page} of {totalPages}
          </span>

          <button
            type="button"
            onClick={() =>
              setPage((current) =>
                Math.min(totalPages, current + 1),
              )
            }
            disabled={page >= totalPages}
          >
            Next
          </button>
        </section>
      )}
    </div>
  );
}

function CaseCard({
  record,
  clientName,
}: {
  record: CaseWithRelations;
  clientName: string;
}) {
  const nextHearingState = getDateState(record.next_hearing_at);
  const nextActionState = getDateState(record.next_action_at);

  return (
    <article className="case-card">
      <header className="case-card-header">
        <div className="case-card-title-block">
          <div className="case-card-reference-row">
            <span className="case-matter-number">
              {record.matter_number ?? record.case_number}
            </span>

            {record.requires_urgent_action && (
              <span className="case-urgent-indicator">
                <AlertTriangle size={13} />
                Urgent action
              </span>
            )}
          </div>

          <h3>{record.case_type || 'Untitled matter'}</h3>

          <Link
            className="case-client-link"
            to={`/clients/${record.client_id}`}
          >
            <UserRound size={15} />
            {clientName}
          </Link>
        </div>

        <Link
          to={`/cases/${record.id}`}
          className="case-open-button"
          aria-label={`Open ${record.matter_number ?? record.case_number}`}
        >
          <ArrowRight size={18} />
        </Link>
      </header>

      <div className="case-badge-row">
        <span
          className={`case-status-badge ${normalizeClass(record.status)}`}
        >
          {formatLabel(record.status)}
        </span>
        <span
          className={`case-priority-badge ${normalizeClass(record.priority)}`}
        >
          {formatLabel(record.priority)}
        </span>
        <span
          className={`case-risk-badge ${normalizeClass(record.risk_level)}`}
        >
          <ShieldAlert size={13} />
          {formatLabel(record.risk_level)} risk
        </span>
      </div>

      <div className="case-card-information">
        <CaseInfo
          label="Court"
          value={record.court || 'Not assigned'}
        />
        <CaseInfo
          label="Court Case No."
          value={record.court_case_number || 'Not provided'}
        />
        <CaseInfo
          label="Opponent"
          value={
            record.opponent_name ??
            record.opponent_company ??
            'Not provided'
          }
        />
        <CaseInfo
          label="Responsible Lawyer"
          value={
            record.responsible_lawyer?.full_name ??
            record.assigned_staff?.full_name ??
            record.assigned_lawyer ??
            'Unassigned'
          }
        />
      </div>

      <div className="case-deadline-grid">
        <Deadline
          icon={<CalendarClock size={16} />}
          label="Next Hearing"
          value={
            record.next_hearing_at
              ? formatDateTime(record.next_hearing_at)
              : 'Not scheduled'
          }
          state={nextHearingState}
        />
        <Deadline
          icon={<Clock3 size={16} />}
          label="Next Action"
          value={
            record.next_action_at
              ? formatDateTime(record.next_action_at)
              : 'Not scheduled'
          }
          state={nextActionState}
        />
      </div>

      <div className="case-progress-block">
        <div>
          <span>Progress</span>
          <strong>
            {Math.min(
              100,
              Math.max(0, Number(record.completion_percentage ?? 0)),
            )}
            %
          </strong>
        </div>
        <div className="case-progress-track">
          <span
            style={{
              width: `${Math.min(
                100,
                Math.max(
                  0,
                  Number(record.completion_percentage ?? 0),
                ),
              )}%`,
            }}
          />
        </div>
      </div>

      <footer className="case-card-footer">
        <div>
          <span>Claim</span>
          <strong>
            {formatCurrency(
              record.claim_amount ?? record.case_value,
              record.currency ?? undefined,
            )}
          </strong>
        </div>

        <div>
          <span>Outstanding</span>
          <strong>
            {formatCurrency(
              record.outstanding_balance,
              record.currency ?? undefined,
            )}
          </strong>
        </div>

        <div className="case-card-actions">
          <Link
            to={`/cases/${record.id}/edit`}
            className="secondary-action-button"
          >
            Edit
          </Link>
          <Link
            to={`/cases/${record.id}`}
            className="primary-action-button"
          >
            Open Matter
          </Link>
        </div>
      </footer>
    </article>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  helper,
  loading,
  tone = 'default',
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  helper: string;
  loading: boolean;
  tone?: 'default' | 'warning' | 'danger' | 'financial';
}) {
  return (
    <article className={`cases-summary-card ${tone}`}>
      <div className="cases-summary-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{loading ? '—' : value}</strong>
        <small>{helper}</small>
      </div>
    </article>
  );
}

function FilterField({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: ReactNode;
}) {
  return (
    <div className="filter-field">
      <label htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}

function CaseInfo({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Deadline({
  icon,
  label,
  value,
  state,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  state: 'neutral' | 'upcoming' | 'overdue';
}) {
  return (
    <div className={`case-deadline ${state}`}>
      {icon}
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function CasesState({
  title,
  description,
  error = false,
  action,
}: {
  title: string;
  description: string;
  error?: boolean;
  action?: ReactNode;
}) {
  return (
    <div
      className={`cases-empty-state ${error ? 'error' : ''}`}
      role={error ? 'alert' : undefined}
    >
      <FolderKanban size={28} />
      <strong>{title}</strong>
      <p>{description}</p>
      {action}
    </div>
  );
}

function normalizeClass(
  value: string | null | undefined,
): string {
  return String(value ?? 'unknown')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function formatLabel(
  value: string | null | undefined,
): string {
  if (!value) {
    return 'Not provided';
  }

  return value
    .replace(/_/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDateTime(
  value: string | null | undefined,
): string {
  if (!value) {
    return 'Not scheduled';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Invalid date';
  }

  return new Intl.DateTimeFormat('en-AE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getDateState(
  value: string | null | undefined,
): 'neutral' | 'upcoming' | 'overdue' {
  if (!value) {
    return 'neutral';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'neutral';
  }

  const now = new Date();
  const soon = new Date();
  soon.setDate(soon.getDate() + 7);

  if (date < now) {
    return 'overdue';
  }

  if (date <= soon) {
    return 'upcoming';
  }

  return 'neutral';
}

function formatCurrency(
  value: number | null | undefined,
  currency = 'AED',
): string {
  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency: currency || 'AED',
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}