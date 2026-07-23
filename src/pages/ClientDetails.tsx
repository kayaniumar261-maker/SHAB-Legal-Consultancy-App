import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { getClientById } from '../services/clientService';
import type { Client } from '../types/client';
import './ClientDetails.css';

export function ClientDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError('Client ID is missing.');
      setLoading(false);
      return;
    }

    const clientId = id;

    async function loadClient(clientId: string) {
      try {
        const data = await getClientById(clientId);

        if (!data) {
          setError('Client not found.');
          return;
        }

        setClient(data);
      } catch (fetchError) {
        if (fetchError instanceof Error) {
          setError(fetchError.message);
        } else {
          setError('Unable to load client details.');
        }
      } finally {
        setLoading(false);
      }
    }

    loadClient(clientId);
  }, [id]);

  if (loading) {
    return (
      <div className="client-details-page">
        <div className="details-loading">
          Loading client details...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="client-details-page">
        <div className="details-error">{error}</div>
        <button
          type="button"
          className="secondary-action-button"
          onClick={() => navigate('/clients')}
        >
          Back to Clients
        </button>
      </div>
    );
  }

  if (!client) {
    return null;
  }

  return (
    <div className="client-details-page">
      <div className="client-details-header">
        <div>
          <p className="page-eyebrow">
            Client profile
          </p>
          <h2>{client.full_name}</h2>
          <p className="page-intro">
            Complete record for {client.full_name} and related matter summaries.
          </p>
        </div>

        <button
          type="button"
          className="secondary-action-button"
          onClick={() => navigate('/clients')}
        >
          Back to Clients
        </button>
      </div>

      <section className="client-details-grid">
        <article className="client-details-card">
          <h3>Contact Details</h3>
          <div className="details-row">
            <span>Email</span>
            <strong>{client.email ?? 'Not provided'}</strong>
          </div>
          <div className="details-row">
            <span>Phone</span>
            <strong>{client.phone ?? 'Not provided'}</strong>
          </div>
          <div className="details-row">
            <span>Nationality</span>
            <strong>{client.nationality ?? 'Not provided'}</strong>
          </div>
          <div className="details-row">
            <span>Address</span>
            <strong>{client.address ?? 'Not provided'}</strong>
          </div>
        </article>

        <article className="client-details-card">
          <h3>Identification</h3>
          <div className="details-row">
            <span>Emirates ID</span>
            <strong>{client.emirates_id ?? 'Not provided'}</strong>
          </div>
          <div className="details-row">
            <span>Passport</span>
            <strong>{client.passport_number ?? 'Not provided'}</strong>
          </div>
          <div className="details-row">
            <span>Status</span>
            <strong className={`status-badge ${client.status}`}>
              {client.status}
            </strong>
          </div>
          <div className="details-row">
            <span>Client Type</span>
            <strong>{client.client_type}</strong>
          </div>
        </article>

        <article className="client-details-card">
          <h3>Company Details</h3>
          <div className="details-row">
            <span>Company Name</span>
            <strong>{client.company_name ?? 'Not provided'}</strong>
          </div>
          <div className="details-row">
            <span>Trade License</span>
            <strong>{client.trade_license_number ?? 'Not provided'}</strong>
          </div>
        </article>

        <article className="client-details-card notes-card">
          <h3>Notes</h3>
          <p>{client.notes ?? 'No notes have been added.'}</p>
        </article>

        <article className="client-details-card timeline-card">
          <h3>Placeholders</h3>
          <div className="placeholder-list">
            <span>Matters</span>
            <span>Cases</span>
            <span>Documents</span>
            <span>Invoices</span>
            <span>Payments</span>
            <span>Activity Timeline</span>
          </div>
        </article>
      </section>

      <section className="client-details-meta">
        <div>
          <span>Created</span>
          <strong>{formatDate(client.created_at)}</strong>
        </div>
        <div>
          <span>Updated</span>
          <strong>{formatDate(client.updated_at)}</strong>
        </div>
      </section>
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
