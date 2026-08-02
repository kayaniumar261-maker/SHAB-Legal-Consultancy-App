import { FormEvent, useEffect, useMemo, useState } from 'react';

import type { Task, TaskInsert, TaskPriority, TaskStatus, TaskUpdate } from '../../types/task';
import type { CaseOption, ClientOption, StaffOption } from '../../services/taskService';
import './TaskFormModal.css';

export type TaskFormModalProps = {
  open: boolean;
  task?: Task | null;
  clients: ClientOption[];
  cases: CaseOption[];
  staff: StaffOption[];
  preselectedClientId?: string;
  preselectedCaseId?: string;
  onClose: () => void;
  onSave: (
    id: string | null,
    data: TaskInsert | TaskUpdate,
  ) => Promise<void>;
  loading: boolean;
};

type FormState = {
  title: string;
  description: string;
  client_id: string;
  case_id: string;
  assigned_staff_id: string;
  priority: TaskPriority;
  status: TaskStatus;
  due_at: string;
};

const emptyState: FormState = {
  title: '',
  description: '',
  client_id: '',
  case_id: '',
  assigned_staff_id: '',
  priority: 'Medium',
  status: 'Pending',
  due_at: '',
};

function loadSavedTaskDraft(
  storageKey: string,
  fallback: FormState,
): FormState {
  try {
    const saved =
      window.localStorage.getItem(storageKey);

    if (!saved) {
      return fallback;
    }

    return {
      ...fallback,
      ...(JSON.parse(saved) as Partial<FormState>),
    };
  } catch {
    return fallback;
  }
}

function saveTaskDraft(
  storageKey: string,
  state: FormState,
): void {
  try {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify(state),
    );
  } catch {
    // Local drafts are a convenience only.
  }
}

function clearTaskDraft(
  storageKey: string,
): void {
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // Nothing to clear.
  }
}

export function TaskFormModal({
  open,
  task,
  clients,
  cases,
  staff,
  preselectedClientId,
  preselectedCaseId,
  onClose,
  onSave,
  loading,
}: TaskFormModalProps) {
  const draftStorageKey =
    task?.id
      ? `shab-task-form-draft-${task.id}`
      : `shab-task-form-draft-new-${
          preselectedCaseId ??
          preselectedClientId ??
          'general'
        }`;

  const [formState, setFormState] =
    useState<FormState>(() =>
      loadSavedTaskDraft(
        draftStorageKey,
        emptyState,
      ),
    );

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (task) {
      const fallback = {
        title: task.title,
        description: task.description ?? '',
        client_id: task.client_id ?? '',
        case_id: task.case_id ?? '',
        assigned_staff_id: task.assigned_staff_id ?? '',
        priority: task.priority,
        status: task.status,
        due_at: task.due_at ? task.due_at.split('T')[0] : '',
      };

      setFormState(
        loadSavedTaskDraft(
          draftStorageKey,
          fallback,
        ),
      );
      return;
    }

    let initialClientId = preselectedClientId ?? '';
    let initialCaseId = preselectedCaseId ?? '';

    if (initialCaseId && !initialClientId) {
      const matchingCase = cases.find(
        (caseOption) => caseOption.id === initialCaseId,
      );

      if (matchingCase?.client_id) {
        initialClientId = matchingCase.client_id;
      }
    }

    if (
      initialClientId &&
      initialCaseId
    ) {
      const matchingCase = cases.find(
        (caseOption) => caseOption.id === initialCaseId,
      );

      if (
        matchingCase &&
        matchingCase.client_id !== initialClientId
      ) {
        initialClientId = matchingCase.client_id;
      }
    }

    const fallback = {
      ...emptyState,
      client_id: initialClientId,
      case_id: initialCaseId,
    };

    setFormState(
      loadSavedTaskDraft(
        draftStorageKey,
        fallback,
      ),
    );
    setError(null);
  }, [
    task,
    open,
    preselectedClientId,
    preselectedCaseId,
    cases,
    draftStorageKey,
  ]);

  useEffect(() => {
    if (!open) {
      return;
    }

    saveTaskDraft(
      draftStorageKey,
      formState,
    );
  }, [
    draftStorageKey,
    formState,
    open,
  ]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  const filteredCases = useMemo(() => {
    if (!formState.client_id) {
      return [];
    }

    return cases.filter((c) => c.client_id === formState.client_id);
  }, [cases, formState.client_id]);

  const validationErrors = useMemo(() => {
    const errors: string[] = [];

    if (!formState.title.trim()) {
      errors.push('Task title is required.');
    }

    return errors;
  }, [formState]);

  if (!open) {
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (validationErrors.length > 0) {
      setError(validationErrors.join(' '));
      return;
    }

    const payload: TaskInsert | TaskUpdate = {
      title: formState.title.trim(),
      description: formState.description.trim() || null,
      client_id: formState.client_id || null,
      case_id: formState.case_id || null,
      assigned_staff_id: formState.assigned_staff_id || null,
      priority: formState.priority,
      status: formState.status,
      due_at: formState.due_at || null,
      completed_at: null,
      created_by: null,
    };

    try {
      await onSave(task?.id ?? null, payload);

      clearTaskDraft(draftStorageKey);
      onClose();
    } catch (saveError) {
      if (saveError instanceof Error) {
        setError(saveError.message);
      } else {
        setError('Unable to save task.');
      }
    }
  }

  return (
    <div className="task-modal-layer" role="presentation">
      <button
        type="button"
        className="task-modal-backdrop"
        onClick={onClose}
        aria-label="Close task form"
      />

      <section className="task-modal" role="dialog" aria-modal="true">
        <header className="task-modal-header">
          <div>
            <p className="modal-eyebrow">Task management</p>
            <h3>{task ? 'Edit Task' : 'Add New Task'}</h3>
            <p className="modal-description">
              Create or update a task and assign it to staff members.
            </p>
          </div>

          <button
            type="button"
            className="task-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        <form className="task-form" onSubmit={handleSubmit}>
          <div className="task-modal-body">
            <div className="task-form-grid">
              <div className="task-form-field task-form-field-wide">
                <span>
                  Task Title<strong aria-hidden="true">*</strong>
                </span>
                <input
                  type="text"
                  value={formState.title}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  placeholder="Task title"
                  autoFocus
                />
              </div>

              <div className="task-form-field task-form-field-wide">
                <span>Description</span>
                <textarea
                  value={formState.description}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Task details and notes"
                />
              </div>

              <div className="task-form-field">
                <span>Client</span>
                <select
                  value={formState.client_id}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      client_id: event.target.value,
                      case_id: '',
                    }))
                  }
                >
                  <option value="">Select client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="task-form-field">
                <span>Case</span>
                <select
                  value={formState.case_id}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      case_id: event.target.value,
                    }))
                  }
                  disabled={!formState.client_id}
                >
                  <option value="">Select case</option>
                  {filteredCases.map((caseOption) => (
                    <option key={caseOption.id} value={caseOption.id}>
                      {caseOption.case_number} - {caseOption.case_type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="task-form-field">
                <span>Assigned To</span>
                <select
                  value={formState.assigned_staff_id}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      assigned_staff_id: event.target.value,
                    }))
                  }
                >
                  <option value="">Unassigned</option>
                  {staff.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="task-form-field">
                <span>Priority</span>
                <select
                  value={formState.priority}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      priority: event.target.value as TaskPriority,
                    }))
                  }
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </div>

              <div className="task-form-field">
                <span>Status</span>
                <select
                  value={formState.status}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      status: event.target.value as TaskStatus,
                    }))
                  }
                >
                  <option value="Pending">Pending</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                  <option value="On Hold">On Hold</option>
                </select>
              </div>

              <div className="task-form-field">
                <span>Due Date</span>
                <input
                  type="date"
                  value={formState.due_at}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      due_at: event.target.value,
                    }))
                  }
                />
              </div>
            </div>

            {error ? (
              <div className="validation-error" role="alert">
                {error}
              </div>
            ) : null}
          </div>

          <div className="task-form-draft-note">
            Draft is saved locally on this device until the task is successfully saved.
          </div>

          <footer className="task-form-actions">
            <button
              type="button"
              className="secondary-action-button"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="primary-action-button"
              disabled={loading}
            >
              {loading ? 'Saving…' : (task ? 'Update Task' : 'Create Task')}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
