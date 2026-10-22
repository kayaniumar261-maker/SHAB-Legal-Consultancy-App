import { tr, useLocale } from '../i18n/locale';
import {
  AlertCircle,
  ArrowLeft,
  BriefcaseBusiness,
  FileText,
  Gavel,
  ListTodo,
  Mail,
  Phone,
  ShieldCheck,
  UserRound,
} from 'lucide-react';

import {
  useEffect,
  useState,
} from 'react';

import {
  Link,
  useParams,
} from 'react-router-dom';

import {
  getStaffById,
} from '../services/staffService';

import {
  getStaffWorkloadSummary,
  type StaffWorkloadSummary,
} from '../services/staffDashboardService';

import type {
  Staff,
} from '../types/staff';

import './StaffDetails.css';

export function StaffDetails() {
  const interfaceLanguage = useLocale();
  const { id } = useParams();

  const [staffMember, setStaffMember] =
    useState<Staff | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [workload, setWorkload] =
    useState<StaffWorkloadSummary>({
      cases: 0,
      tasks: 0,
      hearings: 0,
      documents: 0,
    });

  const [workloadLoading, setWorkloadLoading] =
    useState(true);

  useEffect(() => {
    let active = true;

    async function loadStaffMember() {
      if (!id) {
        setError('Staff member ID is missing.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const [
          result,
          workloadResult,
        ] = await Promise.all([
          getStaffById(id),
          getStaffWorkloadSummary(id),
        ]);

        if (!active) {
          return;
        }

        if (!result) {
          setError('Staff member was not found.');
          return;
        }

        setStaffMember(result);
        setWorkload(workloadResult);
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load staff profile.',
        );
      } finally {
        if (active) {
          setLoading(false);
          setWorkloadLoading(false);
        }
      }
    }

    void loadStaffMember();

    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="page-container staff-details-page">
        <div className="staff-details-state">
          <UserRound size={30} />
          <strong>{tr("Loading staff profile…")}</strong>
        </div>
      </div>
    );
  }

  if (error || !staffMember) {
    return (
      <div className="page-container staff-details-page">
        <div className="staff-details-state error">
          <AlertCircle size={30} />
          <strong>{tr("Unable to open staff profile")}</strong>
          <span>{error ?? tr("Staff member was not found.")}</span>

          <Link
            className="secondary-action-button"
            to="/staff"
          >
            <ArrowLeft size={16} />{tr("Back to Staff")}</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container staff-details-page">
      <Link
        className="staff-details-back"
        to="/staff"
      >
        <ArrowLeft size={16} />{tr("Back to Staff")}</Link>

      <section className="staff-profile-header">
        <div className="staff-profile-avatar">
          {getInitials(staffMember.full_name)}
        </div>

        <div className="staff-profile-heading">
          <p className="page-eyebrow">{tr("Employee workspace")}</p>

          <h2>{staffMember.full_name}</h2>

          <div className="staff-profile-badges">
            <span className="staff-role-badge">
              {formatLabel(staffMember.role ?? 'Staff')}
            </span>

            <span
              className={`status-badge status-${staffMember.status}`}
            >
              {formatLabel(staffMember.status)}
            </span>
          </div>
        </div>
      </section>

      <section className="staff-profile-overview-grid">
        <ProfileItem
          icon={<Mail size={18} />}
          label={tr("Email")}
          value={staffMember.email ?? 'Not provided'}
        />

        <ProfileItem
          icon={<Phone size={18} />}
          label={tr("Phone")}
          value={staffMember.phone ?? 'Not provided'}
        />

        <ProfileItem
          icon={<BriefcaseBusiness size={18} />}
          label={tr("Role")}
          value={formatLabel(staffMember.role ?? 'Staff')}
        />

        <ProfileItem
          icon={<ShieldCheck size={18} />}
          label={tr("Status")}
          value={formatLabel(staffMember.status)}
        />
      </section>

      <section className="staff-profile-workspace">
        <div className="staff-workload-heading">
          <div>
            <span className="page-eyebrow">{tr("Operational workload")}</span>

            <h3>{tr("Employee Workspace")}</h3>

            <p>{tr("Live records linked to this staff member.")}</p>
          </div>
        </div>

        <div className="staff-workload-grid">
          <WorkloadCard
            icon={<BriefcaseBusiness size={20} />}
            label={tr("Cases")}
            value={workload.cases}
            loading={workloadLoading}
            to={`/cases?assignedStaffId=${staffMember.id}`}
          />

          <WorkloadCard
            icon={<ListTodo size={20} />}
            label={tr("Tasks")}
            value={workload.tasks}
            loading={workloadLoading}
            to={`/tasks?assignedStaffId=${staffMember.id}`}
          />

          <WorkloadCard
            icon={<Gavel size={20} />}
            label={tr("Hearings")}
            value={workload.hearings}
            loading={workloadLoading}
            to={`/hearings?staffId=${staffMember.id}`}
          />

          <WorkloadCard
            icon={<FileText size={20} />}
            label={tr("Documents")}
            value={workload.documents}
            loading={workloadLoading}
            to={`/documents?staffId=${staffMember.id}`}
          />
        </div>
      </section>
    </div>
  );
}

function WorkloadCard({
  icon,
  label,
  value,
  loading,
  to,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  loading: boolean;
  to: string;
}) {
  const interfaceLanguage = useLocale();
  return (
    <Link
      className="staff-workload-card"
      to={to}
    >
      <div className="staff-workload-icon">
        {icon}
      </div>

      <span>{label}</span>

      <strong>
        {loading ? '…' : value}
      </strong>

      <small>{tr("Open records")}</small>
    </Link>
  );
}

function ProfileItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  const interfaceLanguage = useLocale();
  return (
    <article className="staff-profile-item">
      <div>{icon}</div>

      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();
}

function formatLabel(value: string): string {
  return tr(value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    ));
}
