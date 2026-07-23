import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { CaseForm } from '../components/cases/CaseForm';
import { createCase, getCaseById, getClientOptions, updateCase } from '../services/caseService';
import { getStaff } from '../services/staffService';
import type { Case } from '../types/case';
import type { ClientOption } from '../services/caseService';
import './CaseFormPage.css';

export function CaseFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEditMode = Boolean(id);
  const [caseRecord, setCaseRecord] = useState<Case | null>(null);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [staff, setStaff] = useState<Array<{ id: string; full_name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        const clientOptions = await getClientOptions();
        setClients(clientOptions);
        const staffRows = await getStaff();
        setStaff(staffRows);

        if (isEditMode && id) {
          const caseData = await getCaseById(id);
          if (!caseData) {
            setError('Case not found.');
            return;
          }
          setCaseRecord(caseData);
        }
      } catch (loadError) {
        if (loadError instanceof Error) {
          setError(loadError.message);
        } else {
          setError('Unable to load case form data.');
        }
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [id, isEditMode]);

  const handleSubmit = async (data: Parameters<typeof createCase>[0] | Parameters<typeof updateCase>[1]) => {
    setSaving(true);
    setError(null);

    try {
      if (isEditMode && id) {
        await updateCase(id, data as Parameters<typeof updateCase>[1]);
      } else {
        await createCase(data as Parameters<typeof createCase>[0]);
      }

      navigate('/cases');
    } catch (submitError) {
      if (submitError instanceof Error) {
        setError(submitError.message);
      } else {
        setError('Unable to save case.');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="case-form-page page-container">
        <section className="page-heading">
          <p className="page-eyebrow">Case management</p>
          <h2>{isEditMode ? 'Edit Case' : 'Add Case'}</h2>
          <p className="page-intro">Preparing your case form.</p>
        </section>
        <div className="case-form-loading">Loading form data…</div>
      </div>
    );
  }

  return (
    <div className="case-form-page page-container">
      <section className="page-heading cases-heading">
        <div>
          <p className="page-eyebrow">Case management</p>
          <h2>{isEditMode ? 'Edit Case' : 'Add Case'}</h2>
          <p className="page-intro">
            {isEditMode
              ? 'Update case details and client assignment.'
              : 'Create a new case record and link it to a client.'}
          </p>
        </div>
      </section>

      {error ? (
        <div className="case-form-error">{error}</div>
      ) : null}

      <CaseForm
        caseRecord={caseRecord}
        clients={clients}
        staff={staff}
        loading={saving}
        onSubmit={handleSubmit}
        submitLabel={isEditMode ? 'Update Case' : 'Create Case'}
      />
    </div>
  );
}
