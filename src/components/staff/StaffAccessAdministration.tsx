import { tr, useLocale } from '../../i18n/locale';
import { FormEvent, useEffect, useState } from 'react';
import { History, MailPlus, RefreshCw, ShieldCheck, UserRoundX } from 'lucide-react';

import {
  inviteApprovedAdministrator,
  inviteOperationsStaff,
  listAccessAccounts,
  listAccessAudit,
  resendStaffInvite,
  setAccountActive,
  type AccessAccount,
  type AccessAuditEntry,
} from '../../services/staffAccessAdministrationService';

const approvedAdministrators = [
  { email: 'umar@shabgroup.com', fullName: 'Umar Kayani' },
  { email: 'haider@shabgroup.com', fullName: 'Haider Ali Bukhari' },
  { email: 'siyab@shabgroup.com', fullName: 'Siyab' },
] as const;
const administratorEmails = new Set<string>(approvedAdministrators.map((administrator) => administrator.email));

function accountDisplayName(account: AccessAccount) {
  if (account.full_name?.trim()) return account.full_name.trim();
  return account.email
    .split('@')[0]
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function StaffAccessAdministration() {
  const interfaceLanguage = useLocale();
  const [accounts, setAccounts] = useState<AccessAccount[]>([]);
  const [audit, setAudit] = useState<AccessAuditEntry[]>([]);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const [nextAccounts, nextAudit] = await Promise.all([
        listAccessAccounts(),
        listAccessAudit(),
      ]);
      setAccounts(nextAccounts);
      setAudit(nextAudit);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load access accounts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const missingAdministrators = approvedAdministrators.filter(
    (administrator) => !accounts.some((account) => account.email === administrator.email),
  );

  const inviteAdministrator = async (administrator: typeof approvedAdministrators[number]) => {
    if (!window.confirm(tr("Send an administrator invitation to {0}?", [administrator.email]))) return;
    try {
      setWorking(`admin-${administrator.email}`);
      setError(null);
      setNotice(null);
      await inviteApprovedAdministrator(administrator);
      setNotice(`Administrator invitation sent to ${administrator.email}.`);
      await load();
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : 'Unable to invite administrator.');
    } finally {
      setWorking(null);
    }
  };

  const submitInvite = async (event: FormEvent) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = fullName.trim();
    if (!normalizedName || !normalizedEmail) {
      setError('Full name and email are required.');
      return;
    }
    if (administratorEmails.has(normalizedEmail)) {
      setError('Administrator accounts are fixed and cannot be created from this form.');
      return;
    }
    try {
      setWorking('invite');
      setError(null);
      setNotice(null);
      await inviteOperationsStaff({ email: normalizedEmail, fullName: normalizedName });
      setEmail('');
      setFullName('');
      setNotice(`Invitation sent to ${normalizedEmail}.`);
      await load();
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : 'Unable to invite staff.');
    } finally {
      setWorking(null);
    }
  };

  const changeStatus = async (account: AccessAccount) => {
    const next = !account.is_active;
    if (!window.confirm(tr("{0} {1}?", [next ? 'Activate' : 'Suspend', account.email]))) return;
    try {
      setWorking(account.user_id);
      setError(null);
      setNotice(null);
      await setAccountActive(account.user_id, next);
      setNotice(`${account.email} is now ${next ? 'active' : 'suspended'}.`);
      await load();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Unable to change access.');
    } finally {
      setWorking(null);
    }
  };

  const resend = async (account: AccessAccount) => {
    try {
      setWorking(`invite-${account.user_id}`);
      setError(null);
      setNotice(null);
      await resendStaffInvite(account.email);
      setNotice(`Invitation email resent to ${account.email}.`);
      await load();
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : 'Unable to resend invitation.');
    } finally {
      setWorking(null);
    }
  };

  return (
    <section className="panel staff-access-panel">
      <div className="staff-access-heading">
        <div>
          <p className="page-eyebrow">{tr("Administrator Control")}</p>
          <h3>{tr("Application Access")}</h3>
          <p>{tr("Invite operations staff, suspend access, and review account activity.")}</p>
        </div>
        <span className="staff-access-security"><ShieldCheck size={17} />{" "}{tr("Three approved administrators")}</span>
      </div>

      {missingAdministrators.length ? (
        <div className="staff-admin-provisioning">
          <div>
            <strong>{tr("Complete administrator setup")}</strong>
            <span>{missingAdministrators.length}{" "}{tr("approved administrator account")}{missingAdministrators.length === 1 ? '' : 's'}{" "}{tr("still require an invitation.")}</span>
          </div>
          <div className="staff-admin-provisioning-actions">
            {missingAdministrators.map((administrator) => (
              <button
                key={administrator.email}
                type="button"
                className="secondary-action-button"
                onClick={() => void inviteAdministrator(administrator)}
                disabled={working === `admin-${administrator.email}`}
              >
                <MailPlus size={16} />
                {working === `admin-${administrator.email}` ? tr("Sending…") : tr("Invite {0}", [administrator.fullName])}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <form className="staff-access-invite" onSubmit={submitInvite}>
        <label>{tr("Full name")}<input dir="auto" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder={tr("Staff member name")} /></label>
        <label>{tr("Work email")}<input dir="ltr" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@shabgroup.com" /></label>
        <button className="primary-action-button" disabled={working === 'invite'}><MailPlus size={17} />{working === 'invite' ? tr("Sending…") : tr("Invite Staff")}</button>
      </form>

      {error ? <div className="case-form-error" role="alert">{tr(error)}</div> : null}
      {notice ? <div className="staff-access-notice" role="status">{tr(notice)}</div> : null}

      {loading ? <p>{tr("Loading access accounts…")}</p> : (
        <div className="table-wrapper">
          <table className="data-table staff-access-table">
            <thead><tr><th>{tr("Account")}</th><th>{tr("Access role")}</th><th>{tr("Staff link")}</th><th>{tr("Status")}</th><th>{tr("Controls")}</th></tr></thead>
            <tbody>{accounts.map((account) => (
              <tr key={account.user_id}>
                <td><strong>{accountDisplayName(account)}</strong><span><bdi dir="ltr">{account.email}</bdi></span></td>
                <td>{account.access_role === 'administrator' ? tr("Administrator") : tr("Operations Staff")}</td>
                <td>{account.staff_id ? tr("Linked") : tr("Not linked")}</td>
                <td><span className={`status-badge ${account.is_active ? 'status-active' : 'status-inactive'}`}>{account.is_active ? tr("Active") : tr("Suspended")}</span></td>
                <td><div className="staff-actions">
                  {account.access_role === 'operations_staff' ? <button type="button" className="secondary-action-button" onClick={() => void changeStatus(account)} disabled={working === account.user_id}><UserRoundX size={16} />{account.is_active ? tr("Suspend") : tr("Activate")}</button> : <span className="staff-access-locked">{tr("Protected")}</span>}
                  <button type="button" className="icon-action-button" onClick={() => void resend(account)} disabled={working === `invite-${account.user_id}`} title={tr("Send sign-in invitation")}><RefreshCw size={16} /></button>
                </div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      <details className="staff-access-audit">
        <summary><History size={17} />{" "}{tr("Recent access audit")}</summary>
        {audit.length === 0 ? <p>{tr("No access changes recorded yet.")}</p> : <ul>{audit.map((entry) => <li key={entry.id}><strong>{entry.target_email}</strong><span>{entry.action.replace(/_/g, ' ')}{" "}{tr("by")}{" "}{entry.performed_by_email || tr("system")} · {new Date(entry.created_at).toLocaleString()}</span></li>)}</ul>}
      </details>
    </section>
  );
}
