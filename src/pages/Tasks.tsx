import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Edit3,
  Play,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import {
  getTasks,
  getTaskById,
  getTaskDashboardStats,
  getClientOptions,
  getCaseOptions,
  getStaffOptions,
  createTask,
  updateTask,
  deleteTask,
  completeTask,
  markTaskInProgress,
  type ClientOption,
  type CaseOption,
  type StaffOption,
  type TaskDashboardStats,
} from '../services/taskService';
import type {
  Task,
  TaskPriority,
  TaskStatus,
  TaskFilterOptions,
} from '../types/task';
import { TaskFormModal } from '../components/tasks/TaskFormModal';
import { DeleteTaskModal } from '../components/tasks/DeleteTaskModal';
import './Tasks.css';

const PAGE_SIZE = 12;

const initialStats: TaskDashboardStats = {
  total: 0,
  dueToday: 0,
  overdue: 0,
  inProgress: 0,
  completed: 0,
};

const statusOptions: Array<TaskStatus | 'all'> = [
  'all',
  'Pending',
  'In Progress',
  'Completed',
  'On Hold',
];

const priorityOptions: Array<TaskPriority | 'all'> = [
  'all',
  'Low',
  'Medium',
  'High',
  'Urgent',
];

export function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<TaskDashboardStats>(initialStats);

  const [clients, setClients] = useState<Record<string, string>>({});
  const [cases, setCases] = useState<Record<string, string>>({});
  const [staff, setStaff] = useState<Record<string, string>>({});

  const [clientOptions, setClientOptions] = useState<ClientOption[]>([]);
  const [caseOptions, setCaseOptions] = useState<CaseOption[]>([]);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const clientIdParam = searchParams.get('clientId') ?? '';
  const caseIdParam = searchParams.get('caseId') ?? '';
  const taskIdParam = searchParams.get('taskId') ?? '';
  const createParam = searchParams.get('create') === '1';
  const dateParam = searchParams.get('date') ?? '';

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] =
    useState<TaskStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] =
    useState<TaskPriority | 'all'>('all');
  const [assignedStaffFilter, setAssignedStaffFilter] =
    useState<string | 'all'>('all');

  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);

  const [formLoading, setFormLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [actionTaskId, setActionTaskId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const endOfToday = new Date(startOfToday);
      endOfToday.setDate(endOfToday.getDate() + 1);

      const taskFilters: TaskFilterOptions = {
        search,
        status: statusFilter,
        statusIn:
          dateParam === 'today'
            ? ['Pending', 'In Progress']
            : undefined,
        priority: priorityFilter,
        assignedStaffId: assignedStaffFilter,
        clientId: clientIdParam || undefined,
        caseId: caseIdParam || undefined,
        page,
        pageSize: PAGE_SIZE,
        dueAfter:
          dateParam === 'today'
            ? startOfToday.toISOString()
            : undefined,
        dueBefore:
          dateParam === 'today'
            ? endOfToday.toISOString()
            : undefined,
      };

      const [
        tasksResult,
        statsResult,
        clientOpts,
        caseOpts,
        staffOpts,
      ] = await Promise.all([
        getTasks(taskFilters),
        getTaskDashboardStats(taskFilters),
        getClientOptions(),
        getCaseOptions(),
        getStaffOptions(),
      ]);

      setTasks(tasksResult.data);
      setTotalCount(tasksResult.count);
      setStats(statsResult);

      setClientOptions(clientOpts);
      setCaseOptions(caseOpts);
      setStaffOptions(staffOpts);

      const clientMap = clientOpts.reduce<Record<string, string>>(
        (accumulator, client) => {
          accumulator[client.id] = client.full_name;
          return accumulator;
        },
        {},
      );

      const caseMap = caseOpts.reduce<Record<string, string>>(
        (accumulator, caseItem) => {
          const caseNumber = caseItem.case_number?.trim();

          accumulator[caseItem.id] = caseNumber
            ? caseNumber
            : caseItem.case_type || `Case ${caseItem.id.slice(0, 8)}`;

          return accumulator;
        },
        {},
      );

      const staffMap = staffOpts.reduce<Record<string, string>>(
        (accumulator, staffMember) => {
          accumulator[staffMember.id] = staffMember.name;
          return accumulator;
        },
        {},
      );

      setClients(clientMap);
      setCases(caseMap);
      setStaff(staffMap);
    } catch (fetchError) {
      if (fetchError instanceof Error) {
        setError(fetchError.message);
      } else {
        setError('Unable to load tasks.');
      }
    } finally {
      setLoading(false);
    }
  }, [
    search,
    statusFilter,
    priorityFilter,
    assignedStaffFilter,
    page,
    caseIdParam,
    clientIdParam,
    dateParam,
  ]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const handleSave = async (
    id: string | null,
    data:
      | Parameters<typeof createTask>[0]
      | Parameters<typeof updateTask>[1],
  ) => {
    setFormLoading(true);
    setError(null);

    try {
      if (id) {
        await updateTask(
          id,
          data as Parameters<typeof updateTask>[1],
        );
      } else {
        await createTask(
          data as Parameters<typeof createTask>[0],
        );
      }

      setIsFormOpen(false);
      setActiveTask(null);

      await fetchData();
    } catch (saveError) {
      if (saveError instanceof Error) {
        setError(saveError.message);
      } else {
        setError('Unable to save task.');
      }

      throw saveError;
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    setDeleteLoading(true);
    setError(null);

    try {
      await deleteTask(deleteTarget.id);
      setDeleteTarget(null);

      await fetchData();
    } catch (deleteError) {
      if (deleteError instanceof Error) {
        setError(deleteError.message);
      } else {
        setError('Unable to delete task.');
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleComplete = async (task: Task) => {
    setActionTaskId(task.id);
    setError(null);

    try {
      await completeTask(task.id);
      await fetchData();
    } catch (completeError) {
      if (completeError instanceof Error) {
        setError(completeError.message);
      } else {
        setError('Unable to complete task.');
      }
    } finally {
      setActionTaskId(null);
    }
  };

  const handleMarkInProgress = async (task: Task) => {
    setActionTaskId(task.id);
    setError(null);

    try {
      await markTaskInProgress(task.id);
      await fetchData();
    } catch (progressError) {
      if (progressError instanceof Error) {
        setError(progressError.message);
      } else {
        setError('Unable to update task.');
      }
    } finally {
      setActionTaskId(null);
    }
  };

  const openNewTask = () => {
    setActiveTask(null);
    setIsFormOpen(true);
  };

  useEffect(() => {
    let active = true;

    async function openFromUrl() {
      if (createParam) {
        setActiveTask(null);
        setIsFormOpen(true);
      }

      if (taskIdParam) {
        try {
          const task = await getTaskById(taskIdParam);

          if (active && task) {
            setActiveTask(task);
            setIsFormOpen(true);
          }
        } catch {
          // ignore; task fetch errors handled in normal data load
        }
      }

      if (createParam) {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('create');
        setSearchParams(nextParams, { replace: true });
      }
    }

    void openFromUrl();

    return () => {
      active = false;
    };
  }, [createParam, taskIdParam, searchParams, setSearchParams]);

  const openEditTask = (task: Task) => {
    setActiveTask(task);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    if (formLoading) {
      return;
    }

    setActiveTask(null);
    setIsFormOpen(false);
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setPriorityFilter('all');
    setAssignedStaffFilter('all');
    setPage(1);
  };

  const hasActiveFilters =
    search.trim().length > 0 ||
    statusFilter !== 'all' ||
    priorityFilter !== 'all' ||
    assignedStaffFilter !== 'all';

  const filteredLabel = useMemo(() => {
    if (dateParam === 'today') {
      return 'Tasks due today';
    }

    if (caseIdParam || clientIdParam) {
      return caseIdParam
        ? 'Tasks for selected matter'
        : 'Tasks for selected client';
    }

    return hasActiveFilters ? 'Filtered tasks' : 'All tasks';
  }, [hasActiveFilters, caseIdParam, clientIdParam, dateParam]);

  return (
    <div className="tasks-page page-container">
      <section className="page-heading tasks-heading">
        <div>
          <p className="page-eyebrow">Task management</p>
          <h2>Tasks</h2>
          <p className="page-intro">
            Manage assignments, monitor deadlines and track team
            progress from one central workspace.
          </p>
        </div>

        <button
          type="button"
          className="primary-action-button"
          onClick={openNewTask}
        >
          <Plus size={18} />
          Add Task
        </button>
      </section>

      <section
        className="tasks-stats-grid"
        aria-label="Task summary"
      >
        <article className="task-stat-card">
          <div className="task-stat-icon">
            <ClipboardList size={20} />
          </div>
          <div>
            <span>Total Tasks</span>
            <strong>{stats.total}</strong>
          </div>
        </article>

        <article className="task-stat-card">
          <div className="task-stat-icon">
            <Clock3 size={20} />
          </div>
          <div>
            <span>Due Today</span>
            <strong>{stats.dueToday}</strong>
          </div>
        </article>

        <article className="task-stat-card task-stat-card-warning">
          <div className="task-stat-icon">
            <AlertTriangle size={20} />
          </div>
          <div>
            <span>Overdue</span>
            <strong>{stats.overdue}</strong>
          </div>
        </article>

        <article className="task-stat-card">
          <div className="task-stat-icon">
            <Play size={20} />
          </div>
          <div>
            <span>In Progress</span>
            <strong>{stats.inProgress}</strong>
          </div>
        </article>

        <article className="task-stat-card task-stat-card-success">
          <div className="task-stat-icon">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <span>Completed</span>
            <strong>{stats.completed}</strong>
          </div>
        </article>
      </section>

      {caseIdParam || clientIdParam ? (
        <section className="tasks-context-banner">
          <div>
            <strong>
              {caseIdParam
                ? 'Showing tasks for selected matter'
                : 'Showing tasks for selected client'}
            </strong>
            <span>
              {caseIdParam
                ? 'Filtered to the current case context in the tasks workspace.'
                : 'Filtered to the current client context in the tasks workspace.'}
            </span>
          </div>

          <button
            type="button"
            className="tasks-clear-filters"
            onClick={() => navigate('/tasks')}
          >
            Clear Context
          </button>
        </section>
      ) : null}

      <section className="tasks-toolbar">
        <div className="tasks-search">
          <Search size={18} />

          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search tasks by title or description"
            aria-label="Search tasks"
          />
        </div>

        <div className="tasks-filters">
          <div className="filter-field">
            <label htmlFor="task-status-filter">Status</label>

            <select
              id="task-status-filter"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(
                  event.target.value as TaskStatus | 'all',
                );
                setPage(1);
              }}
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status === 'all'
                    ? 'All statuses'
                    : status}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-field">
            <label htmlFor="task-priority-filter">
              Priority
            </label>

            <select
              id="task-priority-filter"
              value={priorityFilter}
              onChange={(event) => {
                setPriorityFilter(
                  event.target.value as
                    | TaskPriority
                    | 'all',
                );
                setPage(1);
              }}
            >
              {priorityOptions.map((priority) => (
                <option key={priority} value={priority}>
                  {priority === 'all'
                    ? 'All priorities'
                    : priority}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-field">
            <label htmlFor="task-staff-filter">
              Assigned To
            </label>

            <select
              id="task-staff-filter"
              value={assignedStaffFilter}
              onChange={(event) => {
                setAssignedStaffFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">All staff</option>

              {staffOptions.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="tasks-status-row">
        <div>
          <strong>{filteredLabel}</strong>
          <span>
            {totalCount}{' '}
            {totalCount === 1 ? 'task' : 'tasks'}
          </span>
        </div>

        {hasActiveFilters ? (
          <button
            type="button"
            className="tasks-clear-filters"
            onClick={clearFilters}
          >
            Clear filters
          </button>
        ) : null}
      </section>

      {error ? (
        <div className="tasks-error" role="alert">
          {error}
        </div>
      ) : null}

      <section className="tasks-table-wrapper">
        <table className="tasks-table">
          <thead>
            <tr>
              <th>Task</th>
              <th>Client</th>
              <th>Case</th>
              <th>Assigned To</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Due Date</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="loading-cell">
                  Loading tasks…
                </td>
              </tr>
            ) : tasks.length === 0 ? (
              <tr>
                <td colSpan={8} className="empty-cell">
                  <div className="tasks-empty-state">
                    <ClipboardList size={28} />
                    <strong>No tasks found</strong>
                    <span>
                      {hasActiveFilters
                        ? 'Try changing or clearing the current filters.'
                        : 'Create your first task to get started.'}
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              tasks.map((task) => {
                const actionLoading =
                  actionTaskId === task.id;

                return (
                  <tr key={task.id}>
                    <td className="task-title-cell">
                      <strong>{task.title}</strong>

                      {task.description ? (
                        <span className="task-description">
                          {task.description}
                        </span>
                      ) : null}
                    </td>

                    <td>
                      {task.client_id ? (
                        <Link to={`/clients/${task.client_id}`}>
                          {clients[task.client_id] ?? 'Unknown client'}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>

                    <td>
                      {task.case_id ? (
                        <Link to={`/cases/${task.case_id}`}>
                          {cases[task.case_id] ?? `Case ${task.case_id.slice(0, 8)}`}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>

                    <td>
                      {task.assigned_staff_id
                        ? staff[task.assigned_staff_id] ??
                          'Unknown staff'
                        : '—'}
                    </td>

                    <td>
                      <span
                        className={`priority-badge priority-${task.priority.toLowerCase()}`}
                      >
                        {task.priority}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`status-badge status-${task.status
                          .toLowerCase()
                          .replace(/\s+/g, '-')}`}
                      >
                        {task.status}
                      </span>
                    </td>

                    <td>
                      {task.due_at
                        ? formatDate(task.due_at)
                        : '—'}
                    </td>

                    <td className="task-actions">
                      {task.status !== 'Completed' ? (
                        <>
                          <button
                            type="button"
                            className="action-button complete-button"
                            onClick={() =>
                              void handleComplete(task)
                            }
                            title="Mark complete"
                            aria-label={`Mark ${task.title} complete`}
                            disabled={actionLoading}
                          >
                            <CheckCircle2 size={16} />
                          </button>

                          {task.status !== 'In Progress' ? (
                            <button
                              type="button"
                              className="action-button progress-button"
                              onClick={() =>
                                void handleMarkInProgress(task)
                              }
                              title="Mark in progress"
                              aria-label={`Mark ${task.title} in progress`}
                              disabled={actionLoading}
                            >
                              <Play size={16} />
                            </button>
                          ) : null}
                        </>
                      ) : null}

                      <button
                        type="button"
                        className="action-button edit-button"
                        onClick={() => openEditTask(task)}
                        title="Edit task"
                        aria-label={`Edit ${task.title}`}
                        disabled={actionLoading}
                      >
                        <Edit3 size={16} />
                      </button>

                      <button
                        type="button"
                        className="action-button delete-button"
                        onClick={() => setDeleteTarget(task)}
                        title="Delete task"
                        aria-label={`Delete ${task.title}`}
                        disabled={actionLoading}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>

      {totalPages > 1 ? (
        <section
          className="tasks-pagination"
          aria-label="Task pagination"
        >
          <button
            type="button"
            onClick={() =>
              setPage((current) =>
                Math.max(1, current - 1),
              )
            }
            disabled={page <= 1 || loading}
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
            disabled={page >= totalPages || loading}
          >
            Next
          </button>
        </section>
      ) : null}

      <TaskFormModal
        open={isFormOpen}
        task={activeTask}
        clients={clientOptions}
        cases={caseOptions}
        staff={staffOptions}
        preselectedClientId={clientIdParam || undefined}
        preselectedCaseId={caseIdParam || undefined}
        onClose={closeForm}
        onSave={handleSave}
        loading={formLoading}
      />

      <DeleteTaskModal
        open={Boolean(deleteTarget)}
        taskTitle={deleteTarget?.title ?? ''}
        loading={deleteLoading}
        onCancel={() => {
          if (!deleteLoading) {
            setDeleteTarget(null);
          }
        }}
        onConfirm={handleDelete}
      />
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