import { useEffect, useState } from 'react';

import { getTasksForToday } from '../../services/taskService';
import type { Task } from '../../types/task';

function priorityClass(priority: string): string {
  switch (priority) {
    case 'Urgent':
      return 'task-priority urgent';
    case 'High':
      return 'task-priority high';
    case 'Medium':
      return 'task-priority medium';
    default:
      return 'task-priority low';
  }
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return 'N/A';
  }

  return new Intl.DateTimeFormat('en-AE', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function TaskWidget() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      try {
        const tasksData = await getTasksForToday();
        setTasks(tasksData);
      } catch (loadError) {
        if (loadError instanceof Error) {
          setError(loadError.message);
        } else {
          setError('Unable to load tasks');
        }
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return (
    <section className="dashboard-panel task-widget-panel">
      <div className="panel-heading-row">
        <div>
          <h3>Tasks Due Today</h3>
          <p>Keep track of priority work right now.</p>
        </div>
      </div>

      <div className="task-list">
        {loading ? (
          <p className="task-empty-message">Loading tasks…</p>
        ) : error ? (
          <p className="task-empty-message">Unable to load tasks</p>
        ) : tasks.length === 0 ? (
          <p className="task-empty-message">No tasks due today</p>
        ) : (
          tasks.map((task) => (
            <div key={task.id} className="task-item">
              <div className="task-status-indicator" />
              <div className="task-details">
                <strong>{task.title}</strong>
                <div className="task-meta">
                  <span className={priorityClass(task.priority)}>
                    {task.priority}
                  </span>
                  <span>
                    {task.due_at ? `Due at ${formatTime(task.due_at)}` : 'No due time'}
                  </span>
                  <span>{task.status}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
