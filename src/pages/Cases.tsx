import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Search, SlidersHorizontal } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import { getCases, getClientOptions } from '../services/caseService';
import type { CaseWithRelations as Case, CasePriority, CaseStatus } from '../types/case';
import './Cases.css';

const PAGE_SIZE = 12;

const statusOptions: Array<CaseStatus | 'all'> = [
  'all',
  'Open',
  'Pending',
  'In Court',
  'Closed',
  'Appeal',
];

const priorityOptions: Array<CasePriority | 'all'> = [
  'all',
  'Low',
  'Medium',
  'High',
  'Urgent',
];

const sortOptions = [
  { value: 'filing_date', label: 'Filing Date' },
  { value: 'next_hearing_at', label: 'Next Hearing' },
  { value: 'priority', label: 'Priority' },
  { value: 'status', label: 'Status' },
  { value: 'case_number', label: 'Case Number' },
] as const;

export function Cases() {
  const [cases, setCases] = useState<Case[]>([]);
  const [clients, setClients] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CaseStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<CasePriority | 'all'>('all');
  const [sortBy, setSortBy] = useState<typeof sortOptions[number]['value']>('filing_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize] = useState(PAGE_SIZE);
  const navigate = useNavigate();

  const fetchCases = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [casesResult, clientOptions] = await Promise.all([
        getCases({
          search,
          status: statusFilter,
          priority: priorityFilter,
          sortBy,
          sortOrder,
          page,
          pageSize,
        }),
        getClientOptions(),
      ]);

      setCases(casesResult.data);
      setTotalCount(casesResult.count);
      setClients(
        clientOptions.reduce<Record<string, string>>((acc, client) => {
          acc[client.id] = client.full_name;
          return acc;
        }, {}),
      );
    } catch (fetchError) {
      if (fetchError instanceof Error) {
        setError(fetchError.message);
      } else {
        setError('Unable to load cases.');
      }
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, priorityFilter, sortBy, sortOrder, page, pageSize]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const filteredLabel = useMemo(() => {
    if (search || statusFilter !== 'all' || priorityFilter !== 'all') {
      return 'Filtered cases';
    }

    return 'All cases';
  }, [search, statusFilter, priorityFilter]);

  const handleResetFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setPriorityFilter('all');
    setSortBy('filing_date');
    setSortOrder('desc');
    setPage(1);
  };

  return (
    <div className="cases-page page-container">
      <section className="page-heading cases-heading">
        <div>
          <p className="page-eyebrow">Case management</p>
          <h2>Cases</h2>
          <p className="page-intro">
            Manage all matters, track hearings, and link cases directly to clients.
          </p>
        </div>

        <button
          type="button"
          className="primary-action-button"
          onClick={() => navigate('/cases/new')}
        >
          <Plus size={18} /> Add Case
        </button>
      </section>

      <section className="cases-toolbar">
        <div className="cases-search">
          <Search size={18} />
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search case number, client, court, opponent, lawyer"
            aria-label="Search cases"
          />
        </div>

        <div className="cases-filters">
          <div className="filter-field">
            <label>Status</label>
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as CaseStatus | 'all');
                setPage(1);
              }}
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status === 'all' ? 'All statuses' : status}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-field">
            <label>Priority</label>
            <select
              value={priorityFilter}
              onChange={(event) => {
                setPriorityFilter(event.target.value as CasePriority | 'all');
                setPage(1);
              }}
            >
              {priorityOptions.map((priority) => (
                <option key={priority} value={priority}>
                  {priority === 'all' ? 'All priorities' : priority}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-field">
            <label>Sort</label>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as typeof sortOptions[number]['value'])}
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-field">
            <label>Order</label>
            <select
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value as 'asc' | 'desc')}
            >
              <option value="desc">Newest first</option>
              <option value="asc">Oldest first</option>
            </select>
          </div>

          <button
            type="button"
            className="secondary-action-button reset-filters-button"
            onClick={handleResetFilters}
          >
            <SlidersHorizontal size={18} /> Reset
          </button>
        </div>
      </section>

      <section className="cases-status-row">
        <div>
          <strong>{filteredLabel}</strong>
          <span>{totalCount} total cases</span>
        </div>
      </section>

      <section className="cases-grid">
        {loading ? (
          <div className="cases-empty-state">Loading cases…</div>
        ) : error ? (
          <div className="cases-empty-state">{error}</div>
        ) : cases.length === 0 ? (
          <div className="cases-empty-state">No cases found.</div>
        ) : (
          cases.map((caseRecord) => (
            <article key={caseRecord.id} className="case-card">
              <div className="case-card-header">
                <div>
                  <p className="case-card-number">{caseRecord.case_number}</p>
                  <h3>{caseRecord.case_type}</h3>
                  <p className="case-card-client">
                        {caseRecord.client?.full_name ?? clients[caseRecord.client_id] ?? 'Unknown client'}
                      </p>
                </div>

                <Link
                  to={`/cases/${caseRecord.id}`}
                  className="case-card-link"
                >
                  View
                </Link>
              </div>

              <div className="case-card-body">
                <div>
                  <span>Case status</span>
                  <strong>{caseRecord.status}</strong>
                </div>
                <div>
                  <span>Priority</span>
                  <strong>{caseRecord.priority}</strong>
                </div>
                <div>
                  <span>Filing date</span>
                  <strong>{formatDate(caseRecord.filing_date)}</strong>
                </div>
                <div>
                  <span>Next hearing</span>
                  <strong>
                    {caseRecord.next_hearing_at
                      ? formatDate(caseRecord.next_hearing_at)
                      : 'Not scheduled'}
                  </strong>
                </div>
                <div>
                  <span>Assigned Staff</span>
                  <strong>{caseRecord.assigned_staff?.full_name ?? caseRecord.assigned_staff_id ?? 'Unassigned'}</strong>
                </div>
              </div>

              <footer className="case-card-actions">
                <Link
                  to={`/cases/${caseRecord.id}/edit`}
                  className="secondary-action-button"
                >
                  Edit
                </Link>
              </footer>
            </article>
          ))
        )}
      </section>

      {totalPages > 1 ? (
        <section className="cases-pagination">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1}
          >
            Previous
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={page >= totalPages}
          >
            Next
          </button>
        </section>
      ) : null}
    </div>
  );
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
