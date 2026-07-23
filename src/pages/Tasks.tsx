import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Edit3, Plus, Search, Trash2, Play } from 'lucide-react';

import {
  getTasks,
  getClientOptions,
  getStaffOptions,
  getCasesByClient,
  createTask,
  updateTask,
  deleteTask,
  completeTask,
  markTaskInProgress,
  type ClientOption,
  type CaseOption,
  type StaffOption,
} from '../services/taskService';
import type { Task, TaskPriority, TaskStatus } from '../types/task';
import { TaskFormModal } from '../components/tasks/TaskFormModal';
import { DeleteTaskModal } from '../components/tasks/DeleteTaskModal';
import './Tasks.css';

const PAGE_SIZE = 12;

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
  const [clients, setClients] = useState<Record<string, string>>({});
  const [cases, setCases] = useState<Record<string, string>>({});
  const [staff, setStaff] = useState<Record<string, string>>({});
  const [clientOptions, setClientOptions] = useState<ClientOption[]>([]);
  const [caseOptions, setCaseOptions] = useState<CaseOption[]>([]);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>('all');
  const [assignedStaffFilter, setAssignedStaffFilter] = useState<string | 'all'>('all');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [tasksResult, clientOpts, staffOpts] = await Promise.all([
        getTasks({
          search,
          status: statusFilter,
          priority: priorityFilter,
          assignedStaffId: assignedStaffFilter,
          page,
          pageSize: PAGE_SIZE,
        }),
        getClientOptions(),
        getStaffOptions(),
      ]);

      setTasks(tasksResult.data);
      setTotalCount(tasksResult.count);
      setClientOptions(clientOpts);
      setStaffOptions(staffOpts);

      const clientMap = clientOpts.reduce<Record<string, string>>((acc, c) => {
        acc[c.id] = c.full_name;
        return acc;
      }, {});
      setClients(clientMap);

      const staffMap = staffOpts.reduce<Record<string, string>>((acc, s) => {
        acc[s.id] = s.name;
        return acc;
      }, {});
      setStaff(staffMap);

      const caseMap = tasksResult.data.reduce<Record<string, string>>((acc, task) => {
        if (task.case_id) {
          acc[task.case_id] = `Case ${task.case_id.slice(0, 8)}`;
        }
        return acc;
      }, {});
      setCases(caseMap);
    } catch (fetchError) {
      if (fetchError instanceof Error) {
        setError(fetchError.message);
      } else {
        setError('Unable to load tasks.');
      }
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, priorityFilter, assignedStaffFilter, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const handleSave = async (
    id: string | null,
    data: Parameters<typeof createTask>[0] | Parameters<typeof updateTask>[1],
  ) => {
    setFormLoading(true);
    try {
      if (id) {
        const updated = await updateTask(id, data as Parameters<typeof updateTask>[1]);
        setTasks((current) =>
          current.map((task) =>
            task.id === id ? updated : task,
          ),
        );
      } else {
        const created = await createTask(data as Parameters<typeof createTask>[0]);
        setTasks((current) => [created, ...current]);
        setTotalCount((current) => current + 1);
      }
      setIsFormOpen(false);
      setActiveTask(null);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    setDeleteLoading(true);
    try {
      await deleteTask(deleteTarget.id);
      setTasks((current) =>
        current.filter((task) => task.id !== deleteTarget.id),
      );
      setTotalCount((current) => Math.max(0, current - 1));
      setDeleteTarget(null);
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
    try {
      const updated = await completeTask(task.id);
      setTasks((current) =>
        current.map((t) =>
          t.id === task.id ? updated : t,
        ),
      );
    } catch (completeError) {
      if (completeError instanceof Error) {
        setError(completeError.message);
      } else {
        setError('Unable to complete task.');
      }
    }
  };

  const handleMarkInProgress = async (task: Task) => {
    try {
      const updated = await markTaskInProgress(task.id);
      setTasks((current) =>
        current.map((t) =>
          t.id === task.id ? updated : t,
        ),
      );
    } catch (progressError) {
      if (progressError instanceof Error) {
        setError(progressError.message);
      } else {
        setError('Unable to update task.');
      }
    }
  };

  const openNewTask = () => {
    setActiveTask(null);
    setIsFormOpen(true);
  };

  const openEditTask = (task: Task) => {
    setActiveTask(task);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setActiveTask(null);
    setIsFormOpen(false);
  };

  const filteredLabel = useMemo(() => {
    if (search || statusFilter !== 'all' || priorityFilter !== 'all' || assignedStaffFilter !== 'all') {
      return 'Filtered tasks';
    }

    return 'All tasks';
  }, [search, statusFilter, priorityFilter, assignedStaffFilter]);

  return (
    <div className="tasks-page page-container">
      <section className="page-heading tasks-heading">
        <div>
          <p className="page-eyebrow">Task management</p>
          <h2>Tasks</h2>
          <p className="page-intro">
            Manage tasks, track progress, and assign work to team members.
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
            <label>Status</label>
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as TaskStatus | 'all');
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
                setPriorityFilter(event.target.value as TaskPriority | 'all');
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
            <label>Assigned To</label>
            <select
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
          <span>{totalCount} total tasks</span>
        </div>
      </section>

      {error ? (
        <div className="tasks-error">{error}</div>
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
                <td colSpan={8} className="loading-cell">Loading tasks…</td>
              </tr>
            ) : tasks.length === 0 ? (
              <tr>
                <td colSpan={8} className="empty-cell">No tasks found.</td>
              </tr>
            ) : (
              tasks.map((task) => (
                <tr key={task.id}>
                  <td className="task-title-cell">
                    <strong>{task.title}</strong>
                  </td>
                  <td>{clients[task.client_id ?? ''] ?? '—'}</td>
                  <td>{task.case_id ? task.case_id.slice(0, 8) : '—'}</td>
                  <td>{staff[task.assigned_staff_id ?? ''] ?? '—'}</td>
                  <td>
                    <span className={`priority-badge priority-${task.priority.toLowerCase()}`}>
                      {task.priority}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge status-${task.status.toLowerCase().replace(' ', '-')}`}>
                      {task.status}
                    </span>
                  </td>
                  <td>{task.due_at ? formatDate(task.due_at) : '—'}</td>
                  <td className="task-actions">
                    {task.status !== 'Completed' ? (
                      <>
                        <button
                          type="button"
                          className="action-button complete-button"
                          onClick={() => handleComplete(task)}
                          title="Mark complete"
                        >
                          <CheckCircle2 size={16} />
                        </button>
                        {task.status !== 'In Progress' ? (
                          <button
                            type="button"
                            className="action-button progress-button"
                            onClick={() => handleMarkInProgress(task)}
                            title="Mark in progress"
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
                      title="Edit"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button
                      type="button"
                      className="action-button delete-button"
                      onClick={() => setDeleteTarget(task)}
                      title="Delete"
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

      {totalPages > 1 ? (
        <section className="tasks-pagination">
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

      <TaskFormModal
        open={isFormOpen}
        task={activeTask}
        clients={clientOptions}
        cases={caseOptions}
        staff={staffOptions}
        onClose={closeForm}
        onSave={handleSave}
        loading={formLoading}
      />

      <DeleteTaskModal
        open={Boolean(deleteTarget)}
        taskTitle={deleteTarget?.title ?? ''}
        loading={deleteLoading}
        onCancel={() => setDeleteTarget(null)}
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
