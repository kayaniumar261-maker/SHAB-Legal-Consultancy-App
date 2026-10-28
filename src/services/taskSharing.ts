import type { Task } from '../types/task';
import type { TaskNotificationContact } from './taskNotificationService';
export function whatsappTaskLink(phone:string,task:Task,assignee:string,now=new Date()):string|null {
  const number=phone.replace(/[\s()-]/g,'');
  if(!/^\+[1-9]\d{7,14}$/.test(number)) return null;
  const due=task.due_at?new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Dubai',dateStyle:'medium',timeStyle:'short'}).format(new Date(task.due_at))+' UAE':'Not set';
  const overdue=task.due_at && Date.parse(task.due_at)<now.getTime() && ['Pending','In Progress'].includes(task.status);
  const message=[overdue?'SHAB - Overdue task follow-up':'SHAB - Task details',`Task: ${task.title}`,`Assigned to: ${assignee}`,`Priority: ${task.priority}`,`Status: ${task.status}`,`Due: ${due}`,task.description?`Details: ${task.description}`:'',`https://shab-legal-consultancy-app.pages.dev/tasks?taskId=${encodeURIComponent(task.id)}`].filter(Boolean).join('\n');
  return `https://wa.me/${number.slice(1)}?text=${encodeURIComponent(message)}`;
}
export function taskShareRecipients(task:Task,contacts:TaskNotificationContact[],now=new Date()) {
  const overdue=task.due_at && Date.parse(task.due_at)<now.getTime() && ['Pending','In Progress'].includes(task.status);
  return contacts.filter(c=>c.active && (c.staff_id===task.assigned_staff_id && c.staff_id!==null || overdue && c.administrator_user_id!==null));
}
