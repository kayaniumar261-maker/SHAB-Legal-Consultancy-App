import { useState } from 'react';
import { Link } from 'react-router-dom';
import { tr, useLocale, getLocale, trEnum } from '../../i18n/locale';
import { loadTaskNotificationSettings, saveTaskNotificationContact, setTaskNotificationsEnabled, retryTaskNotification, type TaskNotificationContact } from '../../services/taskNotificationService';
import './TaskNotificationPanel.css';
export function TaskNotificationPanel() {
  useLocale();
  const [data,setData]=useState<Awaited<ReturnType<typeof loadTaskNotificationSettings>>|null>(null);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [edit,setEdit]=useState<TaskNotificationContact|null>(null);
  const [notice,setNotice]=useState('');
  async function load() {
    setBusy(true);setError('');
    try {setData(await loadTaskNotificationSettings());} catch {setError('Task notification service is not available. Complete server setup before enabling alerts.');}
    finally{setBusy(false);}
  }
  async function act(fn:()=>Promise<void>, message:string) {
    setBusy(true);setError('');setNotice('');
    try{await fn();setNotice(message);setEdit(null);setData(await loadTaskNotificationSettings());}
    catch(e){setError(e instanceof Error?e.message:'Unable to save notification settings.');}
    finally{setBusy(false);}
  }
  const ready=Boolean(data?.configured?.email && data.configured.scheduler);
  return <details className="task-notification-panel" onToggle={e=>{if(e.currentTarget.open && !data && !busy) void load();}}>
    <summary>{tr('Task alerts and email settings')}</summary>
    <p>{tr('In-app task alerts work automatically. Administrators see overdue follow-ups after 9 AM UAE time. WhatsApp messages are prepared manually from each task.')}</p>
    {error && <p role="alert" className="task-alert-error">{tr(error)}</p>}
    {notice && <p role="status">{tr(notice)}</p>}
    {busy && <p role="status">{tr('Loading…')}</p>}
    {data && <>
      <div className="task-alert-controls">
        <strong>{data.enabled?tr('Email alerts enabled'):tr('Email alerts disabled')}</strong>
        <button type="button" disabled={busy || (!data.enabled && !ready)} onClick={()=>void act(()=>setTaskNotificationsEnabled(!data.enabled),'Notification settings saved.')}>{data.enabled?tr('Pause email alerts'):tr('Enable email alerts')}</button>
        <button type="button" disabled={busy} onClick={()=>void load()}>{tr('Refresh')}</button>
      </div>
      <p>{tr('Provider acceptance is recorded. Delivery to the recipient device is not confirmed.')}</p>
      <p>{tr('Enabling alerts also checks existing overdue tasks. Save contact settings for every recipient before enabling.')}</p>
      <p>{tr('Email')}: {data.configured?.email?tr('Configured'):tr('Setup required')} · {tr('WhatsApp')}: {tr('Manual sending - no API setup required')} · {tr('Scheduler credentials')}: {data.configured?.scheduler?tr('Configured'):tr('Setup required')}</p>
      <h3>{tr('Notification recipients')}</h3>
      <div className="task-alert-table"><table><thead><tr><th>{tr('Name')}</th><th>{tr('Email')}</th><th>{tr('WhatsApp')}</th><th>{tr('Actions')}</th></tr></thead><tbody>
      {data.contacts.map(c=><tr key={c.recipient_key}><td>{c.name}<small>{c.administrator_user_id?tr('Administrator escalation'):tr('Staff assignment')} · {c.active?tr('Active'):tr('Inactive')}</small></td><td><bdi dir="ltr">{c.email || '—'}</bdi><small>{c.email_enabled?tr('Enabled'):tr('Disabled')}</small></td><td><bdi dir="ltr">{c.whatsapp_number || '—'}</bdi><small>{tr('Manual sending')}</small></td><td><button type="button" disabled={busy} onClick={()=>setEdit({...c})}>{tr('Edit')}</button></td></tr>)}
      </tbody></table></div>
      {edit && <form className="task-alert-form" onSubmit={e=>{e.preventDefault();void act(()=>saveTaskNotificationContact(edit),'Notification contact saved.');}}>
        <h4>{edit.name}</h4>
        <label>{tr('Notification email')}<input dir="ltr" type="email" value={edit.email ?? ''} onChange={e=>setEdit({...edit,email:e.target.value})}/></label>
        <label>{tr('WhatsApp number')}<input dir="ltr" type="tel" placeholder="+971501234567" value={edit.whatsapp_number ?? ''} onChange={e=>setEdit({...edit,whatsapp_number:e.target.value})}/></label>
        <label><input type="checkbox" checked={edit.email_enabled} onChange={e=>setEdit({...edit,email_enabled:e.target.checked})}/>{tr('Enable task email')}</label>

        <button type="submit" disabled={busy}>{tr('Save')}</button><button type="button" disabled={busy} onClick={()=>setEdit(null)}>{tr('Cancel')}</button>
      </form>}
      <h3>{tr('Recent alert history')}</h3><div className="task-alert-table"><table><thead><tr><th>{tr('Task')}</th><th>{tr('Recipient')}</th><th>{tr('Channel')}</th><th>{tr('Status')}</th><th>{tr('Details')}</th></tr></thead><tbody>
      {data.history.map(d=><tr key={d.id}><td><Link to={`/tasks?taskId=${d.task_id}`}>{tr('View task')}</Link><small>{trEnum(d.kind)}</small><small>{new Date(d.created_at).toLocaleString(getLocale(),{timeZone:'Asia/Dubai'})}</small></td><td>{data.contacts.find(c=>c.recipient_key===d.recipient_key)?.name ?? '—'}</td><td>{trEnum(d.channel)}</td><td>{trEnum(d.status)}</td><td>{d.last_error && tr(d.last_error)}{['blocked','failed'].includes(d.status) && d.attempts<5 && <button type="button" disabled={busy} onClick={()=>void act(()=>retryTaskNotification(d.id),'Alert queued for retry.')}>{tr('Retry alert')}</button>}</td></tr>)}
      {data.history.length===0 && <tr><td colSpan={5}>{tr('No alerts have been queued yet.')}</td></tr>}
      </tbody></table></div>
    </>}
  </details>;
}
