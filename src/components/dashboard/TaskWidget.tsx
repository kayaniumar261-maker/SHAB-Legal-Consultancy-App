import {
  CheckCircle2,
  Clock3,
  ListTodo,
} from 'lucide-react';

import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  completeTask,
  getTasksForToday,
} from '../../services/taskService';

import type { Task } from '../../types/task';

function priorityClass(priority: string | null | undefined): string {
  switch (priority?.toLowerCase()) {
    case 'urgent':
      return 'task-priority urgent';

    case 'high':
      return 'task-priority high';

    case 'medium':
      return 'task-priority medium';

    default:
      return 'task-priority low';
  }
}

function formatTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'N/A';
  }

  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function TaskWidget() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingTaskId, setUpdatingTaskId] =
    useState<string | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const result =
        await getTasksForToday();

      setTasks(result);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load tasks.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  async function handleComplete(
    id: string,
  ) {
    try {
      setUpdatingTaskId(id);

      await completeTask(id);

      setTasks((current) =>
        current.filter(
          (task) => task.id !== id,
        ),
      );
    } catch (completeError) {
      setError(
        completeError instanceof Error
          ? completeError.message
          : 'Unable to complete task.',
      );
    } finally {
      setUpdatingTaskId(null);
    }
  }

  return (
    <section className="dashboard-panel task-widget-panel">
      <div className="panel-heading-row">
        <div>
          <span className="section-tag">
            DAILY WORK
          </span>

          <h3>Tasks Due Today</h3>

          <p>
            Priority work requiring attention today.
          </p>
        </div>

        <div className="task-count-badge">
          {tasks.length}
        </div>
      </div>

      {loading ? (
        <div className="dashboard-widget-state">
          Loading today's tasks…
        </div>
      ) : error && tasks.length === 0 ? (
        <div className="dashboard-widget-state error">
          {error}
        </div>
      ) : tasks.length === 0 ? (
        <div className="dashboard-widget-state">
          <ListTodo size={22} />

          <span>
            No outstanding tasks due today.
          </span>
        </div>
      ) : (
        <div className="task-dashboard-list">
          {tasks.map((task) => (
            <article
              key={task.id}
              className="task-dashboard-item"
            >
              <div className="task-dashboard-main">
                <strong>
                  {task.title}
                </strong>

                <div className="task-dashboard-meta">
                  <span
                    className={priorityClass(
                      task.priority,
                    )}
                  >
                    {task.priority || 'Normal'}
                  </span>

                  {task.due_at && (
                    <span>
                      <Clock3 size={12} />
                      {formatTime(task.due_at)}
                    </span>
                  )}

                  <span>
                    {task.status}
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="task-complete-button"
                onClick={() => {
                  void handleComplete(
                    task.id,
                  );
                }}
                disabled={
                  updatingTaskId === task.id
                }
                title="Mark task completed"
              >
                <CheckCircle2 size={17} />
              </button>
            </article>
          ))}
        </div>
      )}

      {error && tasks.length > 0 && (
        <div className="dashboard-inline-error">
          {error}
        </div>
      )}
    </section>
  );
}