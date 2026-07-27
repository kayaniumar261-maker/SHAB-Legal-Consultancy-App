import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Edit,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';

import {
  createStaff,
  deleteStaff,
  getStaff,
  updateStaff,
} from '../services/staffService';
import type {
  Staff as StaffRecord,
  StaffInsert,
} from '../types/staff';

type StaffRole =
  | 'admin'
  | 'lawyer'
  | 'legal_consultant';

type StaffFormState = {
  full_name: string;
  email: string;
  role: StaffRole;
  phone: string;
  status: StaffRecord['status'];
};

const emptyForm: StaffFormState = {
  full_name: '',
  email: '',
  role: 'legal_consultant',
  phone: '',
  status: 'active',
};

const roleLabels: Record<StaffRole, string> = {
  admin: 'Administrator',
  lawyer: 'Lawyer',
  legal_consultant: 'Legal Consultant',
};

function isStaffRole(value: string | null): value is StaffRole {
  return (
    value === 'admin' ||
    value === 'lawyer' ||
    value === 'legal_consultant'
  );
}

function formatRole(role: string | null): string {
  if (!role) {
    return '—';
  }

  if (isStaffRole(role)) {
    return roleLabels[role];
  }

  return role
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter: string) =>
      letter.toUpperCase(),
    );
}

function formatStatus(
  status: StaffRecord['status'],
): string {
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter: string) =>
      letter.toUpperCase(),
    );
}

export function Staff() {
  const [staff, setStaff] = useState<StaffRecord[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] =
    useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingStaff, setEditingStaff] =
    useState<StaffRecord | null>(null);
  const [formState, setFormState] =
    useState<StaffFormState>(emptyForm);

  const loadStaff = async () => {
    try {
      setLoading(true);
      setError(null);

      const records = await getStaff();
      setStaff(records);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load staff.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStaff();
  }, []);

  const filteredStaff = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return staff;
    }

    return staff.filter((member) => {
      const searchableValues = [
        member.full_name,
        member.email,
        member.role,
        formatRole(member.role),
        member.phone,
        member.status,
        formatStatus(member.status),
      ];

      return searchableValues
        .filter((value): value is string => Boolean(value))
        .some((value) =>
          value.toLowerCase().includes(query),
        );
    });
  }, [search, staff]);

  const openCreateForm = () => {
    setEditingStaff(null);
    setFormState({ ...emptyForm });
    setError(null);
    setIsFormOpen(true);
  };

  const openEditForm = (member: StaffRecord) => {
    setEditingStaff(member);

    setFormState({
      full_name: member.full_name,
      email: member.email ?? '',
      role: isStaffRole(member.role)
        ? member.role
        : 'legal_consultant',
      phone: member.phone ?? '',
      status: member.status,
    });

    setError(null);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    if (saving) {
      return;
    }

    setIsFormOpen(false);
    setEditingStaff(null);
    setFormState({ ...emptyForm });
    setError(null);
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setError(null);

    const fullName = formState.full_name.trim();
    const email = formState.email.trim();
    const phone = formState.phone.trim();

    if (!fullName) {
      setError('Staff name is required.');
      return;
    }

    if (!formState.role) {
      setError('Please select a role.');
      return;
    }

    const payload: StaffInsert = {
      full_name: fullName,
      email: email || null,
      role: formState.role,
      phone: phone || null,
      status: formState.status,
    };

    try {
      setSaving(true);

      if (editingStaff) {
        const updated = await updateStaff(
          editingStaff.id,
          payload,
        );

        setStaff((current) =>
          current
            .map((member) =>
              member.id === updated.id
                ? updated
                : member,
            )
            .sort((a, b) =>
              a.full_name.localeCompare(b.full_name),
            ),
        );
      } else {
        const created = await createStaff(payload);

        setStaff((current) =>
          [...current, created].sort((a, b) =>
            a.full_name.localeCompare(b.full_name),
          ),
        );
      }

      setIsFormOpen(false);
      setEditingStaff(null);
      setFormState({ ...emptyForm });
      setError(null);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Unable to save staff member.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (
    member: StaffRecord,
  ) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${member.full_name}?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(member.id);
      setError(null);

      await deleteStaff(member.id);

      setStaff((current) =>
        current.filter(
          (record) => record.id !== member.id,
        ),
      );
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Unable to delete staff member.',
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="page-container">
      <section className="page-heading">
        <div>
          <p className="page-eyebrow">
            SHAB Legal Consultancy
          </p>

          <h2>Staff</h2>

          <p>
            Manage lawyers, legal consultants,
            administrators, and support staff.
          </p>
        </div>

        <button
          type="button"
          className="primary-action-button"
          onClick={openCreateForm}
        >
          <Plus size={18} />
          Add Staff
        </button>
      </section>

      <section className="panel">
        <div className="staff-toolbar">
          <div className="staff-search">
            <Search size={18} />

            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search staff..."
              aria-label="Search staff"
            />
          </div>

          <div className="staff-count">
            <Users size={18} />

            <span>
              {filteredStaff.length} staff member
              {filteredStaff.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>

        {error ? (
          <div
            className="case-form-error"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        {loading ? (
          <p>Loading staff...</p>
        ) : filteredStaff.length === 0 ? (
          <div className="staff-empty-state">
            <Users size={42} />

            <h3>No staff members found</h3>

            <p>
              Add your first staff member to begin
              assigning cases and tasks.
            </p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredStaff.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <strong>
                        {member.full_name}
                      </strong>
                    </td>

                    <td>
                      {formatRole(member.role)}
                    </td>

                    <td>
                      {member.email ?? '—'}
                    </td>

                    <td>
                      {member.phone ?? '—'}
                    </td>

                    <td>
                      <span
                        className={`status-badge status-${member.status}`}
                      >
                        {formatStatus(member.status)}
                      </span>
                    </td>

                    <td>
                      <div className="staff-actions">
                        <button
                          type="button"
                          className="icon-action-button"
                          onClick={() =>
                            openEditForm(member)
                          }
                          aria-label={`Edit ${member.full_name}`}
                          title="Edit staff member"
                        >
                          <Edit size={17} />
                        </button>

                        <button
                          type="button"
                          className="icon-action-button danger"
                          onClick={() =>
                            void handleDelete(member)
                          }
                          disabled={
                            deletingId === member.id
                          }
                          aria-label={`Delete ${member.full_name}`}
                          title="Delete staff member"
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {isFormOpen ? (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              closeForm();
            }
          }}
        >
          <section
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="staff-form-title"
          >
            <div className="modal-header">
              <div>
                <p className="page-eyebrow">
                  Staff Management
                </p>

                <h3 id="staff-form-title">
                  {editingStaff
                    ? 'Edit Staff Member'
                    : 'Add Staff Member'}
                </h3>
              </div>

              <button
                type="button"
                className="icon-action-button"
                onClick={closeForm}
                disabled={saving}
                aria-label="Close staff form"
              >
                <X size={20} />
              </button>
            </div>

            <form
              className="case-form"
              onSubmit={handleSubmit}
            >
              <div className="case-form-grid">
                <div className="case-form-field">
                  <label htmlFor="staff_full_name">
                    Full Name
                  </label>

                  <input
                    id="staff_full_name"
                    value={formState.full_name}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        full_name:
                          event.target.value,
                      }))
                    }
                    placeholder="Staff member's full name"
                    autoComplete="name"
                    required
                  />
                </div>

                <div className="case-form-field">
                  <label htmlFor="staff_role">
                    Role
                  </label>

                  <select
                    id="staff_role"
                    value={formState.role}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        role: event.target
                          .value as StaffRole,
                      }))
                    }
                    required
                  >
                    <option value="admin">
                      Administrator
                    </option>

                    <option value="lawyer">
                      Lawyer
                    </option>

                    <option value="legal_consultant">
                      Legal Consultant
                    </option>
                  </select>
                </div>

                <div className="case-form-field">
                  <label htmlFor="staff_email">
                    Email
                  </label>

                  <input
                    id="staff_email"
                    type="email"
                    value={formState.email}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                    placeholder="name@example.com"
                    autoComplete="email"
                  />
                </div>

                <div className="case-form-field">
                  <label htmlFor="staff_phone">
                    Phone
                  </label>

                  <input
                    id="staff_phone"
                    type="tel"
                    value={formState.phone}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        phone: event.target.value,
                      }))
                    }
                    placeholder="+971..."
                    autoComplete="tel"
                  />
                </div>

                <div className="case-form-field">
                  <label htmlFor="staff_status">
                    Status
                  </label>

                  <select
                    id="staff_status"
                    value={formState.status}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        status: event.target
                          .value as StaffRecord['status'],
                      }))
                    }
                    required
                  >
                    <option value="active">
                      Active
                    </option>

                    <option value="inactive">
                      Inactive
                    </option>

                    <option value="on_leave">
                      On Leave
                    </option>
                  </select>
                </div>
              </div>

              {error ? (
                <div
                  className="case-form-error"
                  role="alert"
                >
                  {error}
                </div>
              ) : null}

              <div className="case-form-actions">
                <button
                  type="button"
                  className="secondary-action-button"
                  onClick={closeForm}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-action-button"
                  disabled={saving}
                >
                  {saving
                    ? 'Saving...'
                    : editingStaff
                      ? 'Update Staff'
                      : 'Create Staff'}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}