import { useEffect, useMemo, useState } from 'react';

import type { Client } from '../../types/client';
import type { ClientInsert, ClientUpdate } from '../../services/clientService';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import './ClientFormModal.css';

type ClientFormModalProps = {
  open: boolean;
  client?: Client | null;
  onClose: () => void;
  onSave: (
    id: string | null,
    data: ClientInsert | ClientUpdate,
  ) => Promise<void>;
  loading: boolean;
};

type FormState = {
  client_type: Client['client_type'];
  full_name: string;
  email: string;
  phone: string;
  nationality: string;
  emirates_id: string;
  passport_number: string;
  company_name: string;
  trade_license_number: string;
  address: string;
  notes: string;
  status: Client['status'];
};

const emptyState: FormState = {
  client_type: 'individual',
  full_name: '',
  email: '',
  phone: '',
  nationality: '',
  emirates_id: '',
  passport_number: '',
  company_name: '',
  trade_license_number: '',
  address: '',
  notes: '',
  status: 'active',
};

function loadSavedClientDraft(
  storageKey: string,
  fallback: FormState,
): FormState {
  try {
    const saved = window.localStorage.getItem(storageKey);

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

function saveClientDraft(
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

function clearClientDraft(storageKey: string): void {
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // Nothing to clear.
  }
}

export function ClientFormModal({
  open,
  client,
  onClose,
  onSave,
  loading,
}: ClientFormModalProps) {
  const draftStorageKey = client?.id
    ? `shab-client-form-draft-${client.id}`
    : 'shab-client-form-draft-new';

  const [formState, setFormState] = useState<FormState>(() =>
    loadSavedClientDraft(draftStorageKey, emptyState),
  );
  const [error, setError] = useState<string | null>(null);
  const [hydratedDraftKey, setHydratedDraftKey] =
    useState<string | null>(null);
  const isOnline = useOnlineStatus();

  useEffect(() => {
    if (!open) {
      return;
    }

    if (client) {
      setFormState(
        loadSavedClientDraft(draftStorageKey, {
          client_type: client.client_type,
          full_name: client.full_name,
          email: client.email ?? '',
          phone: client.phone ?? '',
          nationality: client.nationality ?? '',
          emirates_id: client.emirates_id ?? '',
          passport_number: client.passport_number ?? '',
          company_name: client.company_name ?? '',
          trade_license_number: client.trade_license_number ?? '',
          address: client.address ?? '',
          notes: client.notes ?? '',
          status: client.status,
        }),
      );
      return;
    }

    setFormState(
      loadSavedClientDraft(draftStorageKey, emptyState),
    );
    setError(null);
  }, [client, draftStorageKey, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setHydratedDraftKey(draftStorageKey);
  }, [draftStorageKey, open]);

  useEffect(() => {
    if (
      !open ||
      hydratedDraftKey !== draftStorageKey
    ) {
      return;
    }

    saveClientDraft(draftStorageKey, formState);
  }, [
    draftStorageKey,
    formState,
    hydratedDraftKey,
    open,
  ]);

  const isCompany = formState.client_type === 'company';

  const validationErrors = useMemo(() => {
    const errors: string[] = [];

    if (!formState.full_name.trim()) {
      errors.push('Full name is required.');
    }

    if (!formState.client_type) {
      errors.push('Client type is required.');
    }

    if (isCompany && !formState.company_name.trim()) {
      errors.push('Company name is required for company clients.');
    }

    return errors;
  }, [formState, isCompany]);

  if (!open) {
    return null;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!isOnline) {
      setError(
        'You are offline. Your draft is saved locally; reconnect before saving this client.',
      );
      return;
    }

    if (validationErrors.length > 0) {
      setError(validationErrors.join(' '));
      return;
    }

    const payload: ClientInsert | ClientUpdate = {
      client_type: formState.client_type,
      full_name: formState.full_name.trim(),
      email: formState.email.trim() || null,
      phone: formState.phone.trim() || null,
      nationality: formState.nationality.trim() || null,
      emirates_id: formState.emirates_id.trim() || null,
      passport_number: formState.passport_number.trim() || null,
      company_name: formState.company_name.trim() || null,
      trade_license_number: formState.trade_license_number.trim() || null,
      address: formState.address.trim() || null,
      notes: formState.notes.trim() || null,
      status: formState.status,
    };

    try {
      await onSave(client?.id ?? null, payload);
      clearClientDraft(draftStorageKey);
      onClose();
    } catch (saveError) {
      if (saveError instanceof Error) {
        setError(saveError.message);
      } else {
        setError('Unable to save client.');
      }
    }
  }

  return (
    <div className="client-modal-layer" role="presentation">
      <button
        type="button"
        className="client-modal-backdrop"
        onClick={onClose}
        aria-label="Close client form"
      />

      <section className="client-modal" role="dialog" aria-modal="true">
        <header className="client-modal-header">
          <div>
            <p className="modal-eyebrow">Client record</p>
            <h3>
              {client ? 'Edit Client' : 'Add New Client'}
            </h3>
            <p className="modal-description">
              Manage individual and company client records with all required identification and contact details.
            </p>
          </div>

          <button
            type="button"
            className="client-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        <form className="client-form" onSubmit={handleSubmit}>
          <div className="client-form-grid">
            <div className="client-form-field">
              <span>
                Client Type<strong aria-hidden="true">*</strong>
              </span>
              <select
                value={formState.client_type}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    client_type: event.target.value as Client['client_type'],
                  }))
                }
              >
                <option value="individual">Individual</option>
                <option value="company">Company</option>
              </select>
            </div>

            <div className="client-form-field">
              <span>
                Full Name<strong aria-hidden="true">*</strong>
              </span>
              <input
                type="text"
                value={formState.full_name}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    full_name: event.target.value,
                  }))
                }
                placeholder="Full legal name"
                autoFocus
              />
            </div>

            <div className="client-form-field">
              <span>Email</span>
              <input
                type="email"
                value={formState.email}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                placeholder="client@example.com"
              />
            </div>

            <div className="client-form-field">
              <span>Phone</span>
              <input
                type="tel"
                value={formState.phone}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    phone: event.target.value,
                  }))
                }
                placeholder="+971 55 123 4567"
              />
            </div>

            <div className="client-form-field">
              <span>Nationality</span>
              <input
                type="text"
                value={formState.nationality}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    nationality: event.target.value,
                  }))
                }
                placeholder="Nationality"
              />
            </div>

            <div className="client-form-field">
              <span>Status</span>
              <select
                value={formState.status}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    status: event.target.value as Client['status'],
                  }))
                }
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="prospect">Prospect</option>
              </select>
            </div>

            <div className="client-form-field">
              <span>Emirates ID</span>
              <input
                type="text"
                value={formState.emirates_id}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    emirates_id: event.target.value,
                  }))
                }
                placeholder="784-XXXX-XXXXXXX-X"
              />
            </div>

            <div className="client-form-field">
              <span>Passport Number</span>
              <input
                type="text"
                value={formState.passport_number}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    passport_number: event.target.value,
                  }))
                }
                placeholder="Passport number"
              />
            </div>

            {isCompany && (
              <>
                <div className="client-form-field">
                  <span>
                    Company Name<strong aria-hidden="true">*</strong>
                  </span>
                  <input
                    type="text"
                    value={formState.company_name}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        company_name: event.target.value,
                      }))
                    }
                    placeholder="Registered company name"
                  />
                </div>

                <div className="client-form-field">
                  <span>Trade License Number</span>
                  <input
                    type="text"
                    value={formState.trade_license_number}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        trade_license_number: event.target.value,
                      }))
                    }
                    placeholder="License number"
                  />
                </div>
              </>
            )}

            <div className="client-form-field client-form-field-wide">
              <span>Address</span>
              <input
                type="text"
                value={formState.address}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    address: event.target.value,
                  }))
                }
                placeholder="Residential or business address"
              />
            </div>

            <div className="client-form-field client-form-field-wide">
              <span>Notes</span>
              <textarea
                rows={4}
                value={formState.notes}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                placeholder="Internal remarks or additional context"
              />
            </div>
          </div>

          {error && (
            <div className="validation-error" role="alert">
              {error}
            </div>
          )}

          <div
            className={
              isOnline
                ? 'client-form-draft-note'
                : 'client-form-draft-note offline'
            }
          >
            {isOnline
              ? 'Draft is saved locally on this device until the client is successfully saved.'
              : 'Offline — draft is saved locally. Reconnect before saving this client to SHAB.'}
          </div>

          <footer className="client-form-actions">
            <button
              type="button"
              className="secondary-action-button"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="primary-action-button"
              disabled={loading || !isOnline}
            >
              {loading
                ? 'Saving…'
                : client
                ? 'Save Client'
                : 'Create Client'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
