import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Eye,
  CheckCircle2,
  XCircle,
  Clock3,
  CalendarDays,
  Gavel,
  RotateCcw,
  MapPin,
  Building2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';

import {
  getHearings,
  createHearing,
  updateHearing,
  deleteHearing,
  markHearingCompleted,
  markHearingAdjourned,
  markHearingCancelled,
} from '../services/hearingService';

import type {
  Hearing,
  HearingInsert,
  HearingUpdate,
  HearingStatus,
  HearingType,
} from '../types/hearing';

import {
  HearingFormModal,
} from '../components/hearings/HearingFormModal';

import {
  DeleteHearingModal,
} from '../components/hearings/DeleteHearingModal';

import {
  HearingDetailsModal,
} from '../components/hearings/HearingDetailsModal';

import './Hearings.css';

const PAGE_SIZE = 10;

const DASHBOARD_PAGE_SIZE = 500;

const ACTIVE_STATUSES = [
  'scheduled',
  'pending',
  'adjourned',
];

function normalizeStatus(
  status: string | null | undefined,
): string {
  return (
    status
      ?.trim()
      .toLowerCase() ??
    ''
  );
}

function startOfToday(): Date {
  const date = new Date();

  date.setHours(
    0,
    0,
    0,
    0,
  );

  return date;
}

function endOfToday(): Date {
  const date = new Date();

  date.setHours(
    23,
    59,
    59,
    999,
  );

  return date;
}

function startOfWeek(): Date {
  const date =
    startOfToday();

  const day =
    date.getDay();

  const diff =
    day === 0
      ? -6
      : 1 - day;

  date.setDate(
    date.getDate() +
      diff,
  );

  return date;
}

function endOfWeek(): Date {
  const date =
    startOfWeek();

  date.setDate(
    date.getDate() +
      6,
  );

  date.setHours(
    23,
    59,
    59,
    999,
  );

  return date;
}

function isSameDay(
  value: string,
  target: Date,
): boolean {
  const date =
    new Date(value);

  return (
    date.getFullYear() ===
      target.getFullYear() &&
    date.getMonth() ===
      target.getMonth() &&
    date.getDate() ===
      target.getDate()
  );
}

function isActiveHearing(
  hearing: Hearing,
): boolean {
  return ACTIVE_STATUSES.includes(
    normalizeStatus(
      hearing.status,
    ),
  );
}

export function Hearings() {
  const [
    hearings,
    setHearings,
  ] = useState<Hearing[]>(
    [],
  );

  const [
    dashboardHearings,
    setDashboardHearings,
  ] = useState<Hearing[]>(
    [],
  );

  const [
    totalCount,
    setTotalCount,
  ] = useState(0);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    dashboardLoading,
    setDashboardLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState<
    string | null
  >(null);

  const [
    searchQuery,
    setSearchQuery,
  ] = useState('');

  const [
    statusFilter,
    setStatusFilter,
  ] = useState<
    HearingStatus | ''
  >('');

  const [
    typeFilter,
    setTypeFilter,
  ] = useState<
    HearingType | ''
  >('');

  const [
    currentPage,
    setCurrentPage,
  ] = useState(1);

  const [
    showFormModal,
    setShowFormModal,
  ] = useState(false);

  const [
    showDeleteModal,
    setShowDeleteModal,
  ] = useState(false);

  const [
    showDetailsModal,
    setShowDetailsModal,
  ] = useState(false);

  const [
    selectedHearing,
    setSelectedHearing,
  ] = useState<
    Hearing | null
  >(null);

  const loadHearings =
    useCallback(
      async () => {
        try {
          setLoading(true);
          setError(null);

          const result =
            await getHearings({
              page:
                currentPage,

              pageSize:
                PAGE_SIZE,

              search:
                searchQuery.trim(),

              filters: {
                status:
                  statusFilter ||
                  undefined,

                hearing_type:
                  typeFilter ||
                  undefined,
              },
            });

          setHearings(
            result.data,
          );

          setTotalCount(
            result.count,
          );
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : 'Failed to load hearings.',
          );

          setHearings(
            [],
          );

          setTotalCount(
            0,
          );
        } finally {
          setLoading(false);
        }
      },
      [
        currentPage,
        searchQuery,
        statusFilter,
        typeFilter,
      ],
    );

  const loadDashboardHearings =
    useCallback(
      async () => {
        try {
          setDashboardLoading(
            true,
          );

          const result =
            await getHearings({
              page: 1,

              pageSize:
                DASHBOARD_PAGE_SIZE,
            });

          setDashboardHearings(
            result.data,
          );
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : 'Failed to load hearing dashboard.',
          );

          setDashboardHearings(
            [],
          );
        } finally {
          setDashboardLoading(
            false,
          );
        }
      },
      [],
    );

  useEffect(() => {
    void loadHearings();
  }, [loadHearings]);

  useEffect(() => {
    void loadDashboardHearings();
  }, [
    loadDashboardHearings,
  ]);

  const refreshAll =
    async () => {
      await Promise.all([
        loadHearings(),
        loadDashboardHearings(),
      ]);
    };

  const dashboardStats =
    useMemo(() => {
      const todayStart =
        startOfToday();

      const todayEnd =
        endOfToday();

      const weekStart =
        startOfWeek();

      const weekEnd =
        endOfWeek();

      return {
        today:
          dashboardHearings.filter(
            (hearing) => {
              const date =
                new Date(
                  hearing.hearing_at,
                );

              return (
                date >=
                  todayStart &&
                date <=
                  todayEnd &&
                isActiveHearing(
                  hearing,
                )
              );
            },
          ).length,

        thisWeek:
          dashboardHearings.filter(
            (hearing) => {
              const date =
                new Date(
                  hearing.hearing_at,
                );

              return (
                date >=
                  weekStart &&
                date <=
                  weekEnd &&
                isActiveHearing(
                  hearing,
                )
              );
            },
          ).length,

        completed:
          dashboardHearings.filter(
            (hearing) =>
              normalizeStatus(
                hearing.status,
              ) ===
              'completed',
          ).length,

        adjourned:
          dashboardHearings.filter(
            (hearing) =>
              normalizeStatus(
                hearing.status,
              ) ===
              'adjourned',
          ).length,

        overdue:
          dashboardHearings.filter(
            (hearing) =>
              new Date(
                hearing.hearing_at,
              ) <
                todayStart &&
              isActiveHearing(
                hearing,
              ),
          ).length,
      };
    }, [
      dashboardHearings,
    ]);

  const todayAgenda =
    useMemo(() => {
      return dashboardHearings
        .filter(
          (hearing) =>
            isSameDay(
              hearing.hearing_at,
              new Date(),
            ),
        )
        .sort(
          (a, b) =>
            new Date(
              a.hearing_at,
            ).getTime() -
            new Date(
              b.hearing_at,
            ).getTime(),
        )
        .slice(
          0,
          4,
        );
    }, [
      dashboardHearings,
    ]);

  const handleAddHearing =
    () => {
      setSelectedHearing(
        null,
      );

      setShowFormModal(
        true,
      );
    };

  const handleEditHearing =
    (
      hearing: Hearing,
    ) => {
      setSelectedHearing(
        hearing,
      );

      setShowFormModal(
        true,
      );
    };

  const handleViewHearing =
    (
      hearing: Hearing,
    ) => {
      setSelectedHearing(
        hearing,
      );

      setShowDetailsModal(
        true,
      );
    };

  const handleDeleteHearing =
    (
      hearing: Hearing,
    ) => {
      setSelectedHearing(
        hearing,
      );

      setShowDeleteModal(
        true,
      );
    };

  const performStatusAction =
    async (
      action: () =>
        Promise<Hearing>,

      fallbackMessage:
        string,
    ) => {
      try {
        setError(null);

        await action();

        await refreshAll();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : fallbackMessage,
        );
      }
    };

  const handleMarkCompleted =
    (
      hearing: Hearing,
    ) =>
      performStatusAction(
        () =>
          markHearingCompleted(
            hearing.id,
          ),

        'Failed to mark the hearing as completed.',
      );

  const handleMarkAdjourned =
    (
      hearing: Hearing,
    ) =>
      performStatusAction(
        () =>
          markHearingAdjourned(
            hearing.id,
          ),

        'Failed to mark the hearing as adjourned.',
      );

  const handleMarkCancelled =
    (
      hearing: Hearing,
    ) =>
      performStatusAction(
        () =>
          markHearingCancelled(
            hearing.id,
          ),

        'Failed to cancel the hearing.',
      );

  const handleSaveHearing =
    async (
      data:
        | HearingInsert
        | HearingUpdate,
    ) => {
      try {
        setError(null);

        if (
          selectedHearing
        ) {
          await updateHearing(
            selectedHearing.id,
            data,
          );
        } else {
          await createHearing(
            data as HearingInsert,
          );
        }

        setShowFormModal(
          false,
        );

        setSelectedHearing(
          null,
        );

        await refreshAll();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to save hearing.',
        );

        throw err;
      }
    };

  const handleConfirmDelete =
    async () => {
      if (
        !selectedHearing
      ) {
        return;
      }

      try {
        setError(null);

        await deleteHearing(
          selectedHearing.id,
        );

        setShowDeleteModal(
          false,
        );

        setSelectedHearing(
          null,
        );

        await refreshAll();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to delete hearing.',
        );

        throw err;
      }
    };

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        totalCount /
          PAGE_SIZE,
      ),
    );

  const startIndex =
    totalCount === 0
      ? 0
      : (currentPage -
          1) *
          PAGE_SIZE +
        1;

  const endIndex =
    Math.min(
      currentPage *
        PAGE_SIZE,
      totalCount,
    );

  const formatDate =
    (
      dateString: string,
    ) =>
      new Date(
        dateString,
      ).toLocaleDateString(
        'en-AE',
        {
          weekday:
            'short',

          day:
            '2-digit',

          month:
            'short',

          year:
            'numeric',
        },
      );

  const formatTime =
    (
      dateString: string,
    ) =>
      new Date(
        dateString,
      ).toLocaleTimeString(
        'en-AE',
        {
          hour:
            '2-digit',

          minute:
            '2-digit',

          hour12:
            true,
        },
      );

  const getStatusBadgeClass =
    (
      status:
        string | null,
    ) =>
      `hearing-status-badge hearing-status-${normalizeStatus(
        status,
      ).replace(
        /\s+/g,
        '-',
      )}`;

  const getTypeTagClass =
    (
      type:
        HearingType,
    ) =>
      `hearing-type-tag hearing-type-${type
        .toLowerCase()
        .replace(
          /\s+/g,
          '-',
        )}`;

  const resetFilters =
    () => {
      setSearchQuery(
        '',
      );

      setStatusFilter(
        '',
      );

      setTypeFilter(
        '',
      );

      setCurrentPage(
        1,
      );
    };

  return (
    <div className="hearings-container">
      <header className="hearings-page-header">
        <div>
          <div className="hearings-eyebrow">
            Litigation Operations
          </div>

          <h1>
            Hearings & Court Calendar
          </h1>

          <p>
            Manage court appearances, outcomes, adjournments and upcoming deadlines.
          </p>
        </div>

        <div className="hearings-header-actions">
          <button
            className="hearings-secondary-button"
            type="button"
            onClick={() =>
              void refreshAll()
            }
            disabled={
              loading ||
              dashboardLoading
            }
          >
            <RefreshCw
              size={17}
            />

            Refresh
          </button>

          <button
            className="hearings-add-button"
            type="button"
            onClick={
              handleAddHearing
            }
          >
            <Plus
              size={18}
            />

            Schedule Hearing
          </button>
        </div>
      </header>

      {error && (
        <div
          className="hearings-error"
          role="alert"
        >
          <XCircle
            size={18}
          />

          <span>
            {error}
          </span>

          <button
            type="button"
            onClick={() =>
              setError(null)
            }
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      <section
        className="hearings-kpi-grid"
        aria-label="Hearing statistics"
      >
        <article className="hearings-kpi-card hearings-kpi-primary">
          <div className="hearings-kpi-icon">
            <CalendarDays
              size={21}
            />
          </div>

          <div>
            <span>
              Today
            </span>

            <strong>
              {dashboardLoading
                ? '—'
                : dashboardStats.today}
            </strong>

            <small>
              Active court appearances
            </small>
          </div>
        </article>

        <article className="hearings-kpi-card">
          <div className="hearings-kpi-icon">
            <Gavel
              size={21}
            />
          </div>

          <div>
            <span>
              This Week
            </span>

            <strong>
              {dashboardLoading
                ? '—'
                : dashboardStats.thisWeek}
            </strong>

            <small>
              Scheduled and pending
            </small>
          </div>
        </article>

        <article className="hearings-kpi-card">
          <div className="hearings-kpi-icon">
            <CheckCircle2
              size={21}
            />
          </div>

          <div>
            <span>
              Completed
            </span>

            <strong>
              {dashboardLoading
                ? '—'
                : dashboardStats.completed}
            </strong>

            <small>
              Recorded outcomes
            </small>
          </div>
        </article>

        <article className="hearings-kpi-card">
          <div className="hearings-kpi-icon">
            <RotateCcw
              size={21}
            />
          </div>

          <div>
            <span>
              Adjourned
            </span>

            <strong>
              {dashboardLoading
                ? '—'
                : dashboardStats.adjourned}
            </strong>

            <small>
              Require follow-up
            </small>
          </div>
        </article>

        <article className="hearings-kpi-card hearings-kpi-alert">
          <div className="hearings-kpi-icon">
            <Clock3
              size={21}
            />
          </div>

          <div>
            <span>
              Overdue
            </span>

            <strong>
              {dashboardLoading
                ? '—'
                : dashboardStats.overdue}
            </strong>

            <small>
              Past active hearings
            </small>
          </div>
        </article>
      </section>

      <section className="hearings-agenda-panel">
        <div className="hearings-section-heading">
          <div>
            <span>
              Daily Agenda
            </span>

            <h2>
              Today's Hearings
            </h2>
          </div>

          <span className="hearings-agenda-date">
            {new Date().toLocaleDateString(
              'en-AE',
              {
                weekday:
                  'long',

                day:
                  '2-digit',

                month:
                  'long',
              },
            )}
          </span>
        </div>

        {dashboardLoading ? (
          <div className="hearings-agenda-empty">
            Loading today's agenda…
          </div>
        ) : todayAgenda.length ===
          0 ? (
          <div className="hearings-agenda-empty">
            No hearings scheduled for today.
          </div>
        ) : (
          <div className="hearings-agenda-list">
            {todayAgenda.map(
              (
                hearing,
              ) => (
                <button
                  type="button"
                  key={
                    hearing.id
                  }
                  className="hearings-agenda-item"
                  onClick={() =>
                    handleViewHearing(
                      hearing,
                    )
                  }
                >
                  <span className="hearings-agenda-time">
                    {formatTime(
                      hearing.hearing_at,
                    )}
                  </span>

                  <span className="hearings-agenda-divider" />

                  <span className="hearings-agenda-content">
                    <strong>
                      {hearing.title}
                    </strong>

                    <small>
                      {hearing.court}

                      {hearing.courtroom
                        ? ` · ${hearing.courtroom}`
                        : ''}
                    </small>
                  </span>

                  <span
                    className={getStatusBadgeClass(
                      hearing.status,
                    )}
                  >
                    {hearing.status}
                  </span>
                </button>
              ),
            )}
          </div>
        )}
      </section>

      <section className="hearings-workspace">
        <div className="hearings-workspace-header">
          <div>
            <span>
              Hearing Register
            </span>

            <h2>
              All Hearings
            </h2>
          </div>

          <div className="hearings-result-count">
            {totalCount}{' '}
            record
            {totalCount ===
            1
              ? ''
              : 's'}
          </div>
        </div>

        <div className="hearings-controls">
          <label className="hearings-search">
            <Search
              size={18}
            />

            <input
              type="search"
              placeholder="Search by title or court…"
              value={
                searchQuery
              }
              onChange={(
                event,
              ) => {
                setSearchQuery(
                  event
                    .target
                    .value,
                );

                setCurrentPage(
                  1,
                );
              }}
            />
          </label>

          <div className="hearings-filters">
            <select
              value={
                statusFilter
              }
              onChange={(
                event,
              ) => {
                setStatusFilter(
                  event
                    .target
                    .value as
                    | HearingStatus
                    | '',
                );

                setCurrentPage(
                  1,
                );
              }}
              className="hearings-filter-select"
              aria-label="Filter by hearing status"
            >
              <option value="">
                All statuses
              </option>

              <option value="Scheduled">
                Scheduled
              </option>

              <option value="Pending">
                Pending
              </option>

              <option value="Completed">
                Completed
              </option>

              <option value="Adjourned">
                Adjourned
              </option>

              <option value="Cancelled">
                Cancelled
              </option>
            </select>

            <select
              value={
                typeFilter
              }
              onChange={(
                event,
              ) => {
                setTypeFilter(
                  event
                    .target
                    .value as
                    | HearingType
                    | '',
                );

                setCurrentPage(
                  1,
                );
              }}
              className="hearings-filter-select"
              aria-label="Filter by hearing type"
            >
              <option value="">
                All hearing types
              </option>

              <option value="Preliminary">
                Preliminary
              </option>

              <option value="Case Management">
                Case Management
              </option>

              <option value="Final Hearing">
                Final Hearing
              </option>

              <option value="Appeal">
                Appeal
              </option>

              <option value="Other">
                Other
              </option>
            </select>

            {(searchQuery ||
              statusFilter ||
              typeFilter) && (
              <button
                type="button"
                className="hearings-clear-button"
                onClick={
                  resetFilters
                }
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="hearings-state-card">
            <div className="hearings-spinner" />

            <strong>
              Loading hearings
            </strong>

            <span>
              Retrieving the latest court schedule.
            </span>
          </div>
        ) : hearings.length ===
          0 ? (
          <div className="hearings-state-card">
            <CalendarDays
              size={34}
            />

            <strong>
              No hearings found
            </strong>

            <span>
              Adjust the filters or schedule a new hearing.
            </span>

            <button
              type="button"
              className="hearings-add-button"
              onClick={
                handleAddHearing
              }
            >
              <Plus
                size={17}
              />

              Schedule Hearing
            </button>
          </div>
        ) : (
          <div className="hearings-card-list">
            {hearings.map(
              (
                hearing,
              ) => {
                const status =
                  normalizeStatus(
                    hearing.status,
                  );

                const canUpdateStatus =
                  ACTIVE_STATUSES.includes(
                    status,
                  );

                return (
                  <article
                    key={
                      hearing.id
                    }
                    className="hearing-record-card"
                  >
                    <div className="hearing-record-date">
                      <span>
                        {new Date(
                          hearing.hearing_at,
                        ).toLocaleDateString(
                          'en-AE',
                          {
                            month:
                              'short',
                          },
                        )}
                      </span>

                      <strong>
                        {new Date(
                          hearing.hearing_at,
                        )
                          .getDate()
                          .toString()
                          .padStart(
                            2,
                            '0',
                          )}
                      </strong>

                      <small>
                        {formatTime(
                          hearing.hearing_at,
                        )}
                      </small>
                    </div>

                    <div className="hearing-record-main">
                      <div className="hearing-record-heading">
                        <div>
                          <div className="hearing-record-tags">
                            <span
                              className={getTypeTagClass(
                                hearing.hearing_type,
                              )}
                            >
                              {hearing.hearing_type}
                            </span>

                            <span
                              className={getStatusBadgeClass(
                                hearing.status,
                              )}
                            >
                              {hearing.status}
                            </span>
                          </div>

                          <h3>
                            {hearing.title}
                          </h3>

                          <p>
                            Case reference:{' '}
                            {hearing.case_id}
                          </p>
                        </div>
                      </div>

                      <div className="hearing-record-meta">
                        <div>
                          <Building2
                            size={16}
                          />

                          <span>
                            <small>
                              Court
                            </small>

                            <strong>
                              {hearing.court}
                            </strong>
                          </span>
                        </div>

                        <div>
                          <MapPin
                            size={16}
                          />

                          <span>
                            <small>
                              Venue
                            </small>

                            <strong>
                              {hearing.courtroom ||
                                hearing.location ||
                                'Not specified'}
                            </strong>
                          </span>
                        </div>

                        <div>
                          <CalendarDays
                            size={16}
                          />

                          <span>
                            <small>
                              Date
                            </small>

                            <strong>
                              {formatDate(
                                hearing.hearing_at,
                              )}
                            </strong>
                          </span>
                        </div>
                      </div>

                      {hearing.outcome && (
                        <div className="hearing-record-outcome">
                          <span>
                            Outcome
                          </span>

                          <p>
                            {hearing.outcome}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="hearing-record-actions">
                      <button
                        type="button"
                        title="View hearing"
                        onClick={() =>
                          handleViewHearing(
                            hearing,
                          )
                        }
                      >
                        <Eye
                          size={16}
                        />

                        <span>
                          View
                        </span>
                      </button>

                      <button
                        type="button"
                        title="Edit hearing"
                        onClick={() =>
                          handleEditHearing(
                            hearing,
                          )
                        }
                      >
                        <Edit2
                          size={16}
                        />

                        <span>
                          Edit
                        </span>
                      </button>

                      {canUpdateStatus && (
                        <>
                          <button
                            type="button"
                            className="hearing-action-success"
                            title="Mark completed"
                            onClick={() =>
                              void handleMarkCompleted(
                                hearing,
                              )
                            }
                          >
                            <CheckCircle2
                              size={16}
                            />

                            <span>
                              Complete
                            </span>
                          </button>

                          <button
                            type="button"
                            className="hearing-action-warning"
                            title="Mark adjourned"
                            onClick={() =>
                              void handleMarkAdjourned(
                                hearing,
                              )
                            }
                          >
                            <RotateCcw
                              size={16}
                            />

                            <span>
                              Adjourn
                            </span>
                          </button>

                          <button
                            type="button"
                            className="hearing-action-danger"
                            title="Cancel hearing"
                            onClick={() =>
                              void handleMarkCancelled(
                                hearing,
                              )
                            }
                          >
                            <XCircle
                              size={16}
                            />

                            <span>
                              Cancel
                            </span>
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        className="hearing-action-danger"
                        title="Delete hearing"
                        onClick={() =>
                          handleDeleteHearing(
                            hearing,
                          )
                        }
                      >
                        <Trash2
                          size={16}
                        />

                        <span>
                          Delete
                        </span>
                      </button>
                    </div>
                  </article>
                );
              },
            )}
          </div>
        )}

        {!loading &&
          totalCount >
            0 && (
            <div className="hearings-pagination">
              <div className="hearings-pagination-info">
                Showing{' '}
                <strong>
                  {startIndex}
                </strong>
                –
                <strong>
                  {endIndex}
                </strong>{' '}
                of{' '}
                <strong>
                  {totalCount}
                </strong>
              </div>

              <div className="hearings-pagination-controls">
                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage(
                      (
                        page,
                      ) =>
                        Math.max(
                          1,
                          page -
                            1,
                        ),
                    )
                  }
                  disabled={
                    currentPage ===
                    1
                  }
                  aria-label="Previous page"
                >
                  <ChevronLeft
                    size={17}
                  />

                  Previous
                </button>

                <span>
                  Page{' '}
                  {currentPage}{' '}
                  of{' '}
                  {totalPages}
                </span>

                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage(
                      (
                        page,
                      ) =>
                        Math.min(
                          totalPages,
                          page +
                            1,
                        ),
                    )
                  }
                  disabled={
                    currentPage >=
                    totalPages
                  }
                  aria-label="Next page"
                >
                  Next

                  <ChevronRight
                    size={17}
                  />
                </button>
              </div>
            </div>
          )}
      </section>

      {showFormModal && (
        <HearingFormModal
          hearing={
            selectedHearing ||
            undefined
          }
          onClose={() => {
            setShowFormModal(
              false,
            );

            setSelectedHearing(
              null,
            );
          }}
          onSave={
            handleSaveHearing
          }
        />
      )}

      {showDeleteModal &&
        selectedHearing && (
          <DeleteHearingModal
            hearing={
              selectedHearing
            }
            onClose={() => {
              setShowDeleteModal(
                false,
              );

              setSelectedHearing(
                null,
              );
            }}
            onConfirm={
              handleConfirmDelete
            }
          />
        )}

      {showDetailsModal &&
        selectedHearing && (
          <HearingDetailsModal
            hearing={
              selectedHearing
            }
            onClose={() => {
              setShowDetailsModal(
                false,
              );

              setSelectedHearing(
                null,
              );
            }}
          />
        )}
    </div>
  );
}