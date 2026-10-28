export type EventKind = 'assigned' | 'updated' | 'due_soon' | 'overdue' | 'follow_up' | 'completed';
export type TaskSnapshot = {
  id: string; title: string; description: string | null; priority: string; status: string;
  due_at: string | null; assigned_staff_id: string | null; notification_revision: number;
};
export type Job = { id: string; task_id: string; revision: number; kind: EventKind;
  recipient_key: string; channel: 'email' | 'whatsapp'; attempts: number; };
export type Contact = { recipient_key: string; email: string | null; whatsapp_number: string | null;
  email_enabled: boolean; whatsapp_enabled: boolean; };
export function shouldSend(job: Job, task: TaskSnapshot | null, now = new Date()): boolean {
  if (!task || task.notification_revision !== job.revision) return false;
  if (job.kind === 'completed') return task.status === 'completed';
  if (!['pending', 'in_progress'].includes(task.status)) return false;
  if (job.kind === 'due_soon' && (!task.due_at || Date.parse(task.due_at) <= now.getTime())) return false;
  if (['overdue', 'follow_up'].includes(job.kind) && (!task.due_at || Date.parse(task.due_at) >= now.getTime())) return false;
  if (job.recipient_key.startsWith('staff:') && job.recipient_key !== `staff:${task.assigned_staff_id}`) return false;
  return true;
}
export function normalisePhone(value: string | null): string | null {
  if (!value || !/^\+[1-9]\d{7,14}$/.test(value)) return null;
  return value.slice(1);
}
export function destination(job: Job, contact: Contact | null): string | null {
  if (!contact) return null;
  if (job.channel === 'whatsapp') return contact.whatsapp_enabled ? normalisePhone(contact.whatsapp_number) : null;
  return contact.email_enabled && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email ?? '') ? contact.email : null;
}
export function taskUrl(base: string, id: string): string {
  const url = new URL(base);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Invalid application URL');
  return `${url.origin}/tasks?taskId=${encodeURIComponent(id)}`;
}
export function makeMessage(task: TaskSnapshot, job: Job, assignee: string, base: string, now: Date): string {
  const label: Record<EventKind, string> = {assigned:'Task assigned', updated:'Task updated', due_soon:'Task due soon', overdue:'Overdue task', follow_up:'Overdue follow-up', completed:'Task completed'};
  const due = task.due_at ? new Intl.DateTimeFormat('en-GB', {timeZone:'Asia/Dubai',dateStyle:'medium',timeStyle:'short'}).format(new Date(task.due_at)) + ' UAE' : 'Not set';
  const late = task.due_at && now.getTime() > Date.parse(task.due_at) && job.kind !== 'completed'
    ? `Overdue by ${Math.max(1, Math.ceil((now.getTime()-Date.parse(task.due_at))/3600000))} hour(s)` : '';
  return [label[job.kind], `Task: ${task.title}`, `Assigned to: ${assignee}`, `Priority: ${task.priority}`, `Due: ${due}`, late,
    task.description ? `Details: ${task.description}` : '', taskUrl(base,task.id)].filter(Boolean).join('\n');
}
export function retryDelay(attempts: number): number { return Math.min(3600, 60 * 2 ** Math.max(0, attempts - 1)); }

export function whatsappSummary(task: TaskSnapshot, job: Job, assignee: string, base: string, now: Date): string {
  const full = makeMessage(task, job, assignee, base, now).replace(/\s+/g,' ');
  const link = taskUrl(base,task.id);
  return full.length <= 900 ? full : `${full.slice(0, 880-link.length)}… ${link}`;
}
