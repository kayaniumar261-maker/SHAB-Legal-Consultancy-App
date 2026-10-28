import { supabase } from '../lib/supabase';
export type TaskNotificationContact = {
  recipient_key: string; staff_id: string | null; administrator_user_id: string | null;
  name: string; active: boolean; email: string | null; whatsapp_number: string | null;
  email_enabled: boolean; whatsapp_enabled: boolean;
};
export type TaskDelivery = {id:string;task_id:string;kind:string;channel:string;recipient_key:string;status:string;attempts:number;last_error:string|null;created_at:string};
export async function loadTaskNotificationSettings() {
  const [settings, contacts, history, configuration] = await Promise.all([
    supabase.from('task_notification_settings').select('enabled').eq('id',1).single(),
    supabase.rpc('get_task_notification_contacts'),
    supabase.from('task_notification_deliveries').select('id,task_id,kind,channel,recipient_key,status,attempts,last_error,created_at').order('created_at',{ascending:false}).limit(50),
    supabase.functions.invoke('task-notifications',{method:'GET'}),
  ]);
  for (const result of [settings,contacts,history]) if(result.error) throw new Error(result.error.message);
  return {enabled:Boolean(settings.data?.enabled),contacts:(contacts.data ?? []) as TaskNotificationContact[],history:(history.data ?? []) as TaskDelivery[],configured:configuration.error ? null : configuration.data?.configured as {email:boolean;whatsapp_manual:boolean;scheduler:boolean}|null};
}
export async function saveTaskNotificationContact(contact: TaskNotificationContact) {
  const email=contact.email?.trim() || null;
  const phone=contact.whatsapp_number?.trim() || null;
  if (contact.email_enabled && (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new Error('Enter a valid notification email.');
  if (phone && !/^\+[1-9]\d{7,14}$/.test(phone)) throw new Error('Enter a WhatsApp number in international format, for example +971501234567.');
  const {error}=await supabase.from('task_notification_contacts').upsert({recipient_key:contact.recipient_key,staff_id:contact.staff_id,administrator_user_id:contact.administrator_user_id,email,whatsapp_number:phone,email_enabled:contact.email_enabled,whatsapp_enabled:false},{onConflict:'recipient_key'});
  if(error) throw new Error(error.message);
}
export async function setTaskNotificationsEnabled(enabled:boolean) {
  const {data,error}=await supabase.from('task_notification_settings').update({enabled,updated_at:new Date().toISOString()}).eq('id',1).select('enabled').single();
  if(error || !data) throw new Error(error?.message || 'Unable to save notification settings.');
}
export async function retryTaskNotification(id:string) {
  const {error}=await supabase.rpc('retry_task_notification',{alert_id:id});
  if(error) throw new Error(error.message);
}
