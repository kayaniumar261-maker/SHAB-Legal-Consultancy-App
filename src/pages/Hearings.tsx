import { tr, getLocale, useLocale, trEnum } from '../i18n/locale';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  useSearchParams,
} from 'react-router-dom';

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
  getHearingById,
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
import { DeletionRequestModal } from '../components/staff/DeletionRequestModal';
import { useAccessProfile } from '../hooks/useAccessProfile';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';
import { getHearingCaseReference } from '../utils/hearingReference';

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
  const interfaceLanguage = useLocale();
  const { profile } = useAccessProfile();
  const administrator = profile?.access_role === 'administrator' && profile.is_active;
  const [searchParams, setSearchParams] =
    useSearchParams();

  const contextCaseId =
    searchParams.get('caseId')?.trim() ||
    '';

  const contextClientId =
    searchParams.get('clientId')?.trim() ||
    '';

  const contextDate =
    searchParams.get('date')?.trim() ||
    '';

  const contextHearingId =
    searchParams.get('hearingId')?.trim() ||
    '';

  const shouldAutoSchedule =
    searchParams.get('schedule') === '1';

  const contextDateRange =
    useMemo(() => {
      if (!contextDate) {
        return null;
      }

      const start =
        contextDate === 'today'
          ? startOfToday()
          : new Date(
              `${contextDate}T00:00:00`,
            );

      if (
        Number.isNaN(start.getTime())
      ) {
        return null;
      }

      const end = new Date(start);

      end.setHours(
        23,
        59,
        59,
        999,
      );

      return {
        start:
          start.toISOString(),
        end:
          end.toISOString(),
      };
    }, [contextDate, interfaceLanguage]);

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

                startDate:
                  contextDateRange?.start,

                endDate:
                  contextDateRange?.end,
              },

              caseId:
                contextCaseId ||
                undefined,

              clientId:
                contextClientId ||
                undefined,
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
        contextCaseId,
        contextClientId,
        contextDateRange,
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

  useEffect(() => {
    if (
      !shouldAutoSchedule ||
      (
        !contextCaseId &&
        !contextClientId
      )
    ) {
      return;
    }

    setSelectedHearing(null);
    setShowFormModal(true);

    const next =
      new URLSearchParams(
        searchParams,
      );

    next.delete('schedule');

    setSearchParams(
      next,
      {
        replace: true,
      },
    );
  }, [
    shouldAutoSchedule,
    contextCaseId,
    contextClientId,
    searchParams,
    setSearchParams,
  ]);

  useEffect(() => {
    if (!contextHearingId) {
      return;
    }

    let active = true;

    async function openRequestedHearing() {
      try {
        const hearing =
          await getHearingById(
            contextHearingId,
          );

        if (
          active &&
          hearing
        ) {
          setSelectedHearing(
            hearing,
          );

          setShowDetailsModal(
            true,
          );
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Unable to open hearing.',
          );
        }
      }
    }

    void openRequestedHearing();

    return () => {
      active = false;
    };
  }, [contextHearingId]);

  const refreshAll =
    async () => {
      await Promise.all([
        loadHearings(),
        loadDashboardHearings(),
      ]);
    };

  useRealtimeRefresh(
    ['hearings', 'cases', 'clients', 'staff'],
    refreshAll,
  );

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
    , interfaceLanguage]);

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
    , interfaceLanguage]);

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
        getLocale("en-AE"),
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
        getLocale("en-AE"),
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
          <div className="hearings-eyebrow">{tr("Litigation Operations")}</div>

          <h1>{tr("Hearings & Court Calendar")}</h1>

          <p>{tr("Manage court appearances, outcomes, adjournments and upcoming deadlines.")}</p>
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
            />{tr("Refresh")}</button>

          <button
            className="hearings-add-button"
            type="button"
            onClick={
              handleAddHearing
            }
          >
            <Plus
              size={18}
            />{tr("Schedule Hearing")}</button>
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
            {tr(error)}
          </span>

          <button
            type="button"
            onClick={() =>
              setError(null)
            }
            aria-label={tr("Dismiss error")}
          >
            ×
          </button>
        </div>
      )}

      <section
        className="hearings-kpi-grid"
        aria-label={tr("Hearing statistics")}
      >
        <article className="hearings-kpi-card hearings-kpi-primary">
          <div className="hearings-kpi-icon">
            <CalendarDays
              size={21}
            />
          </div>

          <div>
            <span>{tr("Today")}</span>

            <strong>
              {dashboardLoading
                ? '—'
                : dashboardStats.today}
            </strong>

            <small>{tr("Active court appearances")}</small>
          </div>
        </article>

        <article className="hearings-kpi-card">
          <div className="hearings-kpi-icon">
            <Gavel
              size={21}
            />
          </div>

          <div>
            <span>{tr("This Week")}</span>

            <strong>
              {dashboardLoading
                ? '—'
                : dashboardStats.thisWeek}
            </strong>

            <small>{tr("Scheduled and pending")}</small>
          </div>
        </article>

        <article className="hearings-kpi-card">
          <div className="hearings-kpi-icon">
            <CheckCircle2
              size={21}
            />
          </div>

          <div>
            <span>{tr("Completed")}</span>

            <strong>
              {dashboardLoading
                ? '—'
                : dashboardStats.completed}
            </strong>

            <small>{tr("Recorded outcomes")}</small>
          </div>
        </article>

        <article className="hearings-kpi-card">
          <div className="hearings-kpi-icon">
            <RotateCcw
              size={21}
            />
          </div>

          <div>
            <span>{tr("Adjourned")}</span>

            <strong>
              {dashboardLoading
                ? '—'
                : dashboardStats.adjourned}
            </strong>

            <small>{tr("Require follow-up")}</small>
          </div>
        </article>

        <article className="hearings-kpi-card hearings-kpi-alert">
          <div className="hearings-kpi-icon">
            <Clock3
              size={21}
            />
          </div>

          <div>
            <span>{tr("Overdue")}</span>

            <strong>
              {dashboardLoading
                ? '—'
                : dashboardStats.overdue}
            </strong>

            <small>{tr("Past active hearings")}</small>
          </div>
        </article>
      </section>

      <section className="hearings-agenda-panel">
        <div className="hearings-section-heading">
          <div>
            <span>{tr("Daily Agenda")}</span>

            <h2>{tr("Today's Hearings")}</h2>
          </div>

          <span className="hearings-agenda-date">
            {new Date().toLocaleDateString(
              getLocale("en-AE"),
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
          <div className="hearings-agenda-empty">{tr("Loading today's agenda…")}</div>
        ) : todayAgenda.length ===
          0 ? (
          <div className="hearings-agenda-empty">{tr("No hearings scheduled for today.")}</div>
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
                    {trEnum(hearing.status)}
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
            <span>{tr("Hearing Register")}</span>

            <h2>{tr("All Hearings")}</h2>
          </div>

          <div className="hearings-result-count">
            {totalCount}{' '}{tr("record")}{totalCount ===
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

            <input dir="auto"
              type="search"
              placeholder={tr("Search by title or court…")}
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
              aria-label={tr("Filter by hearing status")}
            >
              <option value="">{tr("All statuses")}</option>

              <option value="Scheduled">{tr("Scheduled")}</option>

              <option value="Pending">{tr("Pending")}</option>

              <option value="Completed">{tr("Completed")}</option>

              <option value="Adjourned">{tr("Adjourned")}</option>

              <option value="Cancelled">{tr("Cancelled")}</option>
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
              aria-label={tr("Filter by hearing type")}
            >
              <option value="">{tr("All hearing types")}</option>

              <option value="Preliminary">{tr("Preliminary")}</option>

              <option value="Case Management">{tr("Case Management")}</option>

              <option value="Final Hearing">{tr("Final Hearing")}</option>

              <option value="Appeal">{tr("Appeal")}</option>

              <option value="Other">{tr("Other")}</option>
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
              >{tr("Clear filters")}</button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="hearings-state-card">
            <div className="hearings-spinner" />

            <strong>{tr("Loading hearings")}</strong>

            <span>{tr("Retrieving the latest court schedule.")}</span>
          </div>
        ) : hearings.length ===
          0 ? (
          <div className="hearings-state-card">
            <CalendarDays
              size={34}
            />

            <strong>{tr("No hearings found")}</strong>

            <span>{tr("Adjust the filters or schedule a new hearing.")}</span>

            <button
              type="button"
              className="hearings-add-button"
              onClick={
                handleAddHearing
              }
            >
              <Plus
                size={17}
              />{tr("Schedule Hearing")}</button>
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
                          getLocale("en-AE"),
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
                              {trEnum(hearing.hearing_type)}
                            </span>

                            <span
                              className={getStatusBadgeClass(
                                hearing.status,
                              )}
                            >
                              {trEnum(hearing.status)}
                            </span>
                          </div>

                          <h3>
                            {hearing.title}
                          </h3>

                          <p>{tr("Case reference:")}{' '}
                            {getHearingCaseReference(hearing)}
                          </p>
                          {hearing.case?.matter_number?.trim() && (
                            <p>{tr("Matter reference:")}{" "}<bdi dir="ltr">{hearing.case.matter_number}</bdi></p>
                          )}
                          {hearing.case?.client?.full_name?.trim() && (
                            <p>{tr("Client:")}{" "}{hearing.case.client.full_name}</p>
                          )}
                        </div>
                      </div>

                      <div className="hearing-record-meta">
                        <div>
                          <Building2
                            size={16}
                          />

                          <span>
                            <small>{tr("Court")}</small>

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
                            <small>{tr("Venue")}</small>

                            <strong>
                              {hearing.courtroom ||
                                hearing.location ||
                                tr("Not specified")}
                            </strong>
                          </span>
                        </div>

                        <div>
                          <CalendarDays
                            size={16}
                          />

                          <span>
                            <small>{tr("Date")}</small>

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
                          <span>{tr("Outcome")}</span>

                          <p>
                            {hearing.outcome}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="hearing-record-actions">
                      <button
                        type="button"
                        title={tr("View hearing")}
                        onClick={() =>
                          handleViewHearing(
                            hearing,
                          )
                        }
                      >
                        <Eye
                          size={16}
                        />

                        <span>{tr("View")}</span>
                      </button>

                      <button
                        type="button"
                        title={tr("Edit hearing")}
                        onClick={() =>
                          handleEditHearing(
                            hearing,
                          )
                        }
                      >
                        <Edit2
                          size={16}
                        />

                        <span>{tr("Edit")}</span>
                      </button>

                      {canUpdateStatus && (
                        <>
                          <button
                            type="button"
                            className="hearing-action-success"
                            title={tr("Mark completed")}
                            onClick={() =>
                              void handleMarkCompleted(
                                hearing,
                              )
                            }
                          >
                            <CheckCircle2
                              size={16}
                            />

                            <span>{tr("Complete")}</span>
                          </button>

                          <button
                            type="button"
                            className="hearing-action-warning"
                            title={tr("Mark adjourned")}
                            onClick={() =>
                              void handleMarkAdjourned(
                                hearing,
                              )
                            }
                          >
                            <RotateCcw
                              size={16}
                            />

                            <span>{tr("Adjourn")}</span>
                          </button>

                          <button
                            type="button"
                            className="hearing-action-danger"
                            title={tr("Cancel hearing")}
                            onClick={() =>
                              void handleMarkCancelled(
                                hearing,
                              )
                            }
                          >
                            <XCircle
                              size={16}
                            />

                            <span>{tr("Cancel")}</span>
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        className="hearing-action-danger"
                        title={administrator ? tr("Delete hearing") : tr("Request hearing deletion")}
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
                          {administrator ? tr("Delete") : tr("Request deletion")}
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
              <div className="hearings-pagination-info">{tr("Showing")}{' '}
                <strong>
                  {startIndex}
                </strong>
                –
                <strong>
                  {endIndex}
                </strong>{' '}{tr("of")}{' '}
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
                  aria-label={tr("Previous page")}
                >
                  <ChevronLeft
                    size={17}
                  />{tr("Previous")}</button>

                <span>{tr("Page")}{' '}
                  {currentPage}{' '}{tr("of")}{' '}
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
                  aria-label={tr("Next page")}
                >{tr("Next")}<ChevronRight
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
          preselectedCaseId={
            selectedHearing
              ? undefined
              : contextCaseId ||
                undefined
          }
          preselectedClientId={
            selectedHearing
              ? undefined
              : contextClientId ||
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
        selectedHearing && administrator && (
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

      <DeletionRequestModal
        open={showDeleteModal && !administrator && Boolean(selectedHearing)}
        entityType="hearing"
        recordId={selectedHearing?.id ?? null}
        recordLabel={selectedHearing?.title ?? tr("Hearing record")}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedHearing(null);
        }}
      />

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
