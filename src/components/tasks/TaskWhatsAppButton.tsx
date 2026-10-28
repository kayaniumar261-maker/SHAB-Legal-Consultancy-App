import { useEffect, useRef, useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import type { Task } from '../../types/task';
import { supabase } from '../../lib/supabase';
import { tr, useLocale } from '../../i18n/locale';
import type { TaskNotificationContact } from '../../services/taskNotificationService';
import { taskShareRecipients, whatsappTaskLink } from '../../services/taskSharing';
import './TaskNotificationPanel.css';
export function TaskWhatsAppButton({task,assignee}:{task:Task;assignee:string}) {
  useLocale();
  const opener=useRef<HTMLButtonElement>(null);
  const [open,setOpen]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState('');
  const [contacts,setContacts]=useState<TaskNotificationContact[]>([]);
  useEffect(()=>{if(open)return ()=>opener.current?.focus();},[open]);
  async function show() {
    setOpen(true);setLoading(true);setError('');setContacts([]);
    try {const {data,error}=await supabase.rpc('get_task_notification_contacts');if(error)throw error;setContacts(taskShareRecipients(task,data??[]));}
    catch{setError('Unable to load WhatsApp recipients.');}finally{setLoading(false);}
  }
  return <>
    <button ref={opener} type="button" className="action-button" title={tr('Prepare WhatsApp message')} aria-label={tr('Prepare WhatsApp message for {0}',[task.title])} onClick={()=>void show()}><MessageCircle size={16}/></button>
    {open && <div className="task-share-backdrop"><section className="task-share-dialog" onKeyDown={event=>{
      if(event.key==='Escape'){event.preventDefault();setOpen(false);}
      if(event.key==='Tab'){
        const controls=event.currentTarget.querySelectorAll<HTMLElement>('button,a[href]');
        const first=controls[0],last=controls[controls.length-1];
        if(event.shiftKey && document.activeElement===first){event.preventDefault();last?.focus();}
        else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first?.focus();}
      }
    }} role="dialog" aria-modal="true" aria-label={tr('Prepare WhatsApp message')}>
      <button type="button" autoFocus onClick={()=>setOpen(false)} aria-label={tr('Close')}><X size={18}/></button>
      <h3>{tr('Prepare WhatsApp message')}</h3><p>{task.title}</p>
      <p>{tr('Choose a recipient, review the prepared message in WhatsApp, then press Send. Use the SHAB WhatsApp account. This app cannot confirm whether you sent the message.')}</p>
      {loading && <p role="status">{tr('Loading…')}</p>}{error && <p role="alert">{tr(error)}</p>}
      {!loading && !error && contacts.length===0 && <p>{tr('No active staff or administrator recipients are available for this task.')}</p>}
      <ul>{contacts.map(c=>{const href=whatsappTaskLink(c.whatsapp_number??'',task,assignee);return <li key={c.recipient_key}><strong>{c.name}</strong> <bdi dir="ltr">{c.whatsapp_number}</bdi> {href?<a href={href} target="_blank" rel="noopener noreferrer">{tr('Open WhatsApp')}</a>:<span>{tr('Add a valid international WhatsApp number in notification contacts.')}</span>}</li>;})}</ul>
    </section></div>}
  </>;
}
