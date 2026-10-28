import { createClient } from 'npm:@supabase/supabase-js@2.110.7';
import { destination, makeMessage, whatsappSummary, shouldSend, retryDelay, type Job, type TaskSnapshot, type Contact } from './logic.ts';

const env = (name: string) => Deno.env.get(name)?.trim() ?? '';
const headers = {'Content-Type':'application/json', 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'};
const reply = (body: unknown, status=200) => new Response(JSON.stringify(body),{status,headers});
function configuration() {
  return {email: !!(env('RESEND_API_KEY') && env('TASK_EMAIL_FROM')), whatsapp: !!(env('WHATSAPP_ACCESS_TOKEN') && /^\d+$/.test(env('WHATSAPP_PHONE_NUMBER_ID')) && /^v\d+\.\d+$/.test(env('WHATSAPP_GRAPH_VERSION')) && env('WHATSAPP_TASK_TEMPLATE') && env('WHATSAPP_TEMPLATE_LANGUAGE')), scheduler: !!env('TASK_NOTIFICATION_CRON_SECRET')};
}
// No user-supplied destinations, task bodies or scheduler timestamps are accepted.
Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null,{headers});
  const url=env('SUPABASE_URL'), key=env('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return reply({error:'Notification service is not configured.'},503);
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  if (request.method === 'GET') {
    const token=request.headers.get('Authorization')?.replace(/^Bearer /,'') ?? '';
    const {data:{user},error}=await db.auth.getUser(token);
    if (error || !user) return reply({error:'Sign in required.'},401);
    const {data:access,error:accessError}=await db.from('app_user_access').select('access_role,is_active').eq('user_id',user.id).maybeSingle();
    if(accessError || access?.access_role!=='administrator' || !access.is_active) return reply({error:'Administrator access required.'},403);
    return reply({configured:configuration(), delivery_status:'Provider acceptance is recorded; device delivery is not tracked.'});
  }
  if (request.method !== 'POST') return reply({error:'Method not allowed.'},405);
  const secret=env('TASK_NOTIFICATION_CRON_SECRET');
  if (!secret || request.headers.get('Authorization')!==`Bearer ${secret}`) return reply({error:'Scheduler authentication required.'},401);
  try {
    const {data:settings,error:settingsError}=await db.from('task_notification_settings').select('*').eq('id',1).single();
    if(settingsError) throw settingsError;
    if(!settings.enabled) return reply({enabled:false,processed:0});
    const config=configuration();
    // A missing channel configuration must not prevent other channels from progressing.
    const {error:planError}=await db.rpc('plan_task_notifications');
    if(planError) throw planError;
    const {data,error}=await db.rpc('claim_task_notifications',{batch_size:5});
    if(error) throw error;
    let processed=0;
    for (const job of (data ?? []) as Job[]) {
      let outcome: Record<string,unknown>={status:'cancelled',last_error:null};
      try {
        const {data:task,error:taskError}=await db.from('tasks').select('id,title,description,priority,status,due_at,assigned_staff_id,notification_revision').eq('id',job.task_id).maybeSingle();
        if(taskError) throw new Error('Task lookup failed');
        const {data:contact,error:contactError}=await db.rpc('task_notification_contact',{key:job.recipient_key});
        if(contactError) throw new Error('Recipient lookup failed');
        const recipient=(contact?.[0] ?? null) as (Contact & {name:string}) | null;
        const to=destination(job,recipient);
        if(!task || !shouldSend(job,task as TaskSnapshot)) outcome={status:'cancelled',last_error:'Task changed or no longer requires this alert.'};
        else if(!to) outcome={status:'blocked',last_error:'Recipient is inactive, missing contact details or channel permission.'};
        else if(!config[job.channel]) outcome={status:'blocked',last_error:'Sending channel is not configured.'};
        else {
          const {data:assignee,error:assigneeError}=task.assigned_staff_id ? await db.from('staff').select('full_name').eq('id',task.assigned_staff_id).maybeSingle() : {data:null,error:null};
          if(assigneeError) throw new Error('Assignee lookup failed');
          const body=makeMessage(task as TaskSnapshot,job,assignee?.full_name ?? 'Unassigned',env('TASK_APP_URL') || 'https://shab-legal-consultancy-app.pages.dev',new Date());
          let response: Response;
          // A timeout has an uncertain outcome: never automatically retry and risk duplicate alerts.
          try {
            if(job.channel==='email') response=await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(12000),headers:{Authorization:`Bearer ${env('RESEND_API_KEY')}`,'Content-Type':'application/json','Idempotency-Key':`task-alert-${job.id}`},body:JSON.stringify({from:env('TASK_EMAIL_FROM'),to:[to],cc:to.toLowerCase()==='umar@shabgroup.com'?[]:['umar@shabgroup.com'],subject:`SHAB - ${job.kind.replaceAll('_',' ')} - ${task.title}`.replace(/[\r\n]+/g,' ').slice(0,200),text:body})});
            else response=await fetch(`https://graph.facebook.com/${env('WHATSAPP_GRAPH_VERSION')}/${env('WHATSAPP_PHONE_NUMBER_ID')}/messages`,{method:'POST',signal:AbortSignal.timeout(12000),headers:{Authorization:`Bearer ${env('WHATSAPP_ACCESS_TOKEN')}`,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',to,type:'template',template:{name:env('WHATSAPP_TASK_TEMPLATE'),language:{code:env('WHATSAPP_TEMPLATE_LANGUAGE')},components:[{type:'body',parameters:[{type:'text',text:whatsappSummary(task as TaskSnapshot,job,assignee?.full_name ?? 'Unassigned',env('TASK_APP_URL') || 'https://shab-legal-consultancy-app.pages.dev',new Date())}]}]}})});
          } catch { outcome={status:'unknown',last_error:'Provider outcome unknown. Check provider logs before a manual resend.'}; response=null as unknown as Response; }
          if(response) {
            const result=await response.json().catch(()=>({}));
            const providerId=job.channel==='email' ? result.id : result.messages?.[0]?.id;
            if(response.ok && providerId) outcome={status:'accepted',provider_message_id:providerId,accepted_at:new Date().toISOString(),last_error:null};
            else if(response.ok) outcome={status:'unknown',last_error:'Provider accepted request without a message ID; verify before resending.'};
            else {
              const retry=(response.status===429 || response.status>=500) && job.attempts<5;
              outcome={status:retry?'queued':'failed',last_error:`Provider HTTP ${response.status}`,available_at:new Date(Date.now()+retryDelay(job.attempts)*1000).toISOString()};
            }
          }
        }
      } catch { outcome={status:'failed',last_error:'Notification processing failed. Review configuration and retry.'}; }
      const {error:saveError}=await db.from('task_notification_deliveries').update({...outcome,updated_at:new Date().toISOString()}).eq('id',job.id).eq('status','processing');
      if(saveError) throw saveError;
      processed++;
    }
    return reply({processed});
  } catch { return reply({error:'Task notification processing failed.'},500); }
});
