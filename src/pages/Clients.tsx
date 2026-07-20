import {
  Building2,
  Edit3,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import {
  FormEvent,
  useMemo,
  useState,
} from 'react';

import { STORAGE_KEYS } from '../data/constants';
import { useLocalStorage } from '../hooks/useLocalStorage';
import type { Client } from '../types/client';
import { generateId } from '../utils/generateId';
import './Clients.css';

type ClientFormData = {
  name: string;
  company: string;
  email: string;
  phone: string;
  nationality: string;
  emiratesId: string;
  passport: string;
  address: string;
  notes: string;
};

const emptyForm: ClientFormData = {
  name: '',
  company: '',
  email: '',
  phone: '',
  nationality: '',
  emiratesId: '',
  passport: '',
  address: '',
  notes: '',
};

export function Clients() {
  const [clients, setClients] =
    useLocalStorage<Client>(
      STORAGE_KEYS.clients,
      [],
    );

  const [searchTerm, setSearchTerm] =
    useState('');

  const [isFormOpen, setIsFormOpen] =
    useState(false);

  const [editingClientId, setEditingClientId] =
    useState<string | null>(null);

  const [formData, setFormData] =
    useState<ClientFormData>(emptyForm);

  const [formError, setFormError] =
    useState('');

  const filteredClients = useMemo(() => {
    const query = searchTerm
      .trim()
      .toLowerCase();

    if (!query) {
      return clients;
    }

    return clients.filter((client) => {
      const searchableValues = [
        client.name,
        client.company,
        client.email,
        client.phone,
        client.nationality,
        client.emiratesId,
        client.passport,
      ];

      return searchableValues.some((value) =>
        value
          ?.toLowerCase()
          .includes(query),
      );
    });
  }, [clients, searchTerm]);

  const openCreateForm = () => {
    setEditingClientId(null);
    setFormData(emptyForm);
    setFormError('');
    setIsFormOpen(true);
  };

  const openEditForm = (client: Client) => {
    setEditingClientId(client.id);

    setFormData({
      name: client.name,
      company: client.company ?? '',
      email: client.email,
      phone: client.phone,
      nationality:
        client.nationality ?? '',
      emiratesId:
        client.emiratesId ?? '',
      passport: client.passport ?? '',
      address: client.address ?? '',
      notes: client.notes ?? '',
    });

    setFormError('');
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingClientId(null);
    setFormData(emptyForm);
    setFormError('');
  };

  const updateFormField = (
    field: keyof ClientFormData,
    value: string,
  ) => {
    setFormData((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSubmit = (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const name = formData.name.trim();
    const phone = formData.phone.trim();
    const email = formData.email.trim();

    if (!name) {
      setFormError(
        'Client name is required.',
      );
      return;
    }

    if (!phone && !email) {
      setFormError(
        'Enter at least a phone number or email address.',
      );
      return;
    }

    const now = new Date().toISOString();

    if (editingClientId) {
      setClients((currentClients) =>
        currentClients.map((client) =>
          client.id === editingClientId
            ? {
                ...client,
                name,
                company:
                  formData.company.trim(),
                email,
                phone,
                nationality:
                  formData.nationality.trim(),
                emiratesId:
                  formData.emiratesId.trim(),
                passport:
                  formData.passport.trim(),
                address:
                  formData.address.trim(),
                notes:
                  formData.notes.trim(),
                updatedAt: now,
              }
            : client,
        ),
      );
    } else {
      const newClient: Client = {
        id: generateId(),
        name,
        company:
          formData.company.trim(),
        email,
        phone,
        nationality:
          formData.nationality.trim(),
        emiratesId:
          formData.emiratesId.trim(),
        passport:
          formData.passport.trim(),
        address:
          formData.address.trim(),
        notes:
          formData.notes.trim(),
        createdAt: now,
        updatedAt: now,
      };

      setClients((currentClients) => [
        newClient,
        ...currentClients,
      ]);
    }

    closeForm();
  };

  const handleDelete = (
    client: Client,
  ) => {
    const confirmed = window.confirm(
      `Delete the client record for ${client.name}?`,
    );

    if (!confirmed) {
      return;
    }

    setClients((currentClients) =>
      currentClients.filter(
        (item) => item.id !== client.id,
      ),
    );
  };

  return (
    <div className="page-container">
      <section className="page-heading clients-heading">
        <div>
          <p className="page-eyebrow">
            Client management
          </p>

          <h2>Clients</h2>

          <p>
            Maintain complete client
            records, contact details,
            identification information,
            and internal notes.
          </p>
        </div>

        <button
          type="button"
          className="primary-action-button"
          onClick={openCreateForm}
        >
          <Plus size={19} />
          Add Client
        </button>
      </section>

      <section className="clients-toolbar panel">
        <div className="clients-search">
          <Search size={19} />

          <input
            type="search"
            value={searchTerm}
            onChange={(event) =>
              setSearchTerm(
                event.target.value,
              )
            }
            placeholder="Search by name, company, phone, email, Emirates ID, or passport"
            aria-label="Search clients"
          />
        </div>

        <div className="clients-count">
          <strong>{filteredClients.length}</strong>
          <span>
            {filteredClients.length === 1
              ? 'client'
              : 'clients'}
          </span>
        </div>
      </section>

      {filteredClients.length === 0 ? (
        <section className="panel clients-empty-state">
          <UserRound size={48} />

          <h3>
            {clients.length === 0
              ? 'No clients added yet'
              : 'No matching clients'}
          </h3>

          <p>
            {clients.length === 0
              ? 'Create your first client record to begin managing legal matters.'
              : 'Try changing your search terms.'}
          </p>

          {clients.length === 0 && (
            <button
              type="button"
              className="primary-action-button"
              onClick={openCreateForm}
            >
              <Plus size={18} />
              Add First Client
            </button>
          )}
        </section>
      ) : (
        <section className="clients-grid">
          {filteredClients.map(
            (client) => (
              <article
                key={client.id}
                className="client-card"
              >
                <div className="client-card-header">
                  <div className="client-avatar">
                    {getInitials(
                      client.name,
                    )}
                  </div>

                  <div className="client-card-title">
                    <h3>{client.name}</h3>

                    <span>
                      {client.company ||
                        'Individual Client'}
                    </span>
                  </div>

                  <div className="client-card-actions">
                    <button
                      type="button"
                      onClick={() =>
                        openEditForm(client)
                      }
                      aria-label={`Edit ${client.name}`}
                    >
                      <Edit3 size={17} />
                    </button>

                    <button
                      type="button"
                      className="danger-icon-button"
                      onClick={() =>
                        handleDelete(client)
                      }
                      aria-label={`Delete ${client.name}`}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>

                <div className="client-details">
                  {client.phone && (
                    <ClientDetail
                      icon={<Phone size={17} />}
                      label="Phone"
                      value={client.phone}
                    />
                  )}

                  {client.email && (
                    <ClientDetail
                      icon={<Mail size={17} />}
                      label="Email"
                      value={client.email}
                    />
                  )}

                  {client.company && (
                    <ClientDetail
                      icon={
                        <Building2
                          size={17}
                        />
                      }
                      label="Company"
                      value={client.company}
                    />
                  )}

                  {client.address && (
                    <ClientDetail
                      icon={
                        <MapPin size={17} />
                      }
                      label="Address"
                      value={client.address}
                    />
                  )}
                </div>

                <div className="client-card-meta">
                  <span>
                    Nationality:{' '}
                    <strong>
                      {client.nationality ||
                        'Not provided'}
                    </strong>
                  </span>

                  <span>
                    Added:{' '}
                    <strong>
                      {formatDate(
                        client.createdAt,
                      )}
                    </strong>
                  </span>
                </div>
              </article>
            ),
          )}
        </section>
      )}

      {isFormOpen && (
        <div
          className="client-modal-layer"
          role="presentation"
        >
          <button
            type="button"
            className="client-modal-backdrop"
            onClick={closeForm}
            aria-label="Close client form"
          />

          <section
            className="client-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="client-form-title"
          >
            <header className="client-modal-header">
              <div>
                <p className="page-eyebrow">
                  Client record
                </p>

                <h3 id="client-form-title">
                  {editingClientId
                    ? 'Edit Client'
                    : 'Add New Client'}
                </h3>
              </div>

              <button
                type="button"
                className="client-modal-close"
                onClick={closeForm}
                aria-label="Close"
              >
                <X size={21} />
              </button>
            </header>

            <form
              className="client-form"
              onSubmit={handleSubmit}
            >
              <div className="client-form-grid">
                <FormField
                  label="Client Name"
                  required
                >
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(event) =>
                      updateFormField(
                        'name',
                        event.target.value,
                      )
                    }
                    placeholder="Full legal name"
                    autoFocus
                  />
                </FormField>

                <FormField label="Company">
                  <input
                    type="text"
                    value={
                      formData.company
                    }
                    onChange={(event) =>
                      updateFormField(
                        'company',
                        event.target.value,
                      )
                    }
                    placeholder="Company or organisation"
                  />
                </FormField>

                <FormField label="Phone">
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(event) =>
                      updateFormField(
                        'phone',
                        event.target.value,
                      )
                    }
                    placeholder="+971"
                  />
                </FormField>

                <FormField label="Email">
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(event) =>
                      updateFormField(
                        'email',
                        event.target.value,
                      )
                    }
                    placeholder="client@example.com"
                  />
                </FormField>

                <FormField label="Nationality">
                  <input
                    type="text"
                    value={
                      formData.nationality
                    }
                    onChange={(event) =>
                      updateFormField(
                        'nationality',
                        event.target.value,
                      )
                    }
                    placeholder="Nationality"
                  />
                </FormField>

                <FormField label="Emirates ID">
                  <input
                    type="text"
                    value={
                      formData.emiratesId
                    }
                    onChange={(event) =>
                      updateFormField(
                        'emiratesId',
                        event.target.value,
                      )
                    }
                    placeholder="784-XXXX-XXXXXXX-X"
                  />
                </FormField>

                <FormField label="Passport Number">
                  <input
                    type="text"
                    value={
                      formData.passport
                    }
                    onChange={(event) =>
                      updateFormField(
                        'passport',
                        event.target.value,
                      )
                    }
                    placeholder="Passport number"
                  />
                </FormField>

                <FormField label="Address">
                  <input
                    type="text"
                    value={
                      formData.address
                    }
                    onChange={(event) =>
                      updateFormField(
                        'address',
                        event.target.value,
                      )
                    }
                    placeholder="Residential or business address"
                  />
                </FormField>

                <FormField
                  label="Internal Notes"
                  wide
                >
                  <textarea
                    value={formData.notes}
                    onChange={(event) =>
                      updateFormField(
                        'notes',
                        event.target.value,
                      )
                    }
                    placeholder="Relevant background, instructions, or internal remarks"
                    rows={4}
                  />
                </FormField>
              </div>

              {formError && (
                <div
                  className="client-form-error"
                  role="alert"
                >
                  {formError}
                </div>
              )}

              <footer className="client-form-actions">
                <button
                  type="button"
                  className="secondary-action-button"
                  onClick={closeForm}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-action-button"
                >
                  {editingClientId
                    ? 'Save Changes'
                    : 'Create Client'}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

type ClientDetailProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
};

function ClientDetail({
  icon,
  label,
  value,
}: ClientDetailProps) {
  return (
    <div className="client-detail-row">
      <div className="client-detail-icon">
        {icon}
      </div>

      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

type FormFieldProps = {
  label: string;
  required?: boolean;
  wide?: boolean;
  children: React.ReactNode;
};

function FormField({
  label,
  required = false,
  wide = false,
  children,
}: FormFieldProps) {
  return (
    <label
      className={[
        'client-form-field',
        wide ? 'client-form-field-wide' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span>
        {label}
        {required && (
          <strong aria-hidden="true">
            *
          </strong>
        )}
      </span>

      {children}
    </label>
  );
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  return new Intl.DateTimeFormat(
    'en-AE',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    },
  ).format(date);
}
