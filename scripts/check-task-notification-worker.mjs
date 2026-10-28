import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import ts from 'typescript';
const transpile=(s)=>ts.transpile(s,{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS});
const logic={exports:{},Intl,Date,URL};vm.createContext(logic);vm.runInContext(transpile(fs.readFileSync('supabase/functions/task-notifications/logic.ts','utf8')),logic);
let index=fs.readFileSync('supabase/functions/task-notifications/index.ts','utf8').replace(/^import[^\n]*\n/gm,'');
const token='test-only-scheduler-secret';
const task={id:'task-id',title:'Review file',description:'Fictional task details',priority:'high',status:'pending',due_at:new Date(Date.now()+3600000).toISOString(),notification_revision:1,assigned_staff_id:'staff-id'};
const contact={name:'Fictional recipient',recipient_key:'staff:staff-id',email:'person@example.invalid',email_enabled:true,whatsapp_number:'+971501234567',whatsapp_enabled:true};
const job={id:'alert-id',task_id:'task-id',revision:1,recipient_key:'staff:staff-id',channel:'email',kind:'assigned',attempts:1};
async function run(options={}) {
  const calls=[],updates=[];
  let handler;
  const vars={SUPABASE_URL:'https://project.example.invalid',SUPABASE_SERVICE_ROLE_KEY:'server-only-test-key',TASK_NOTIFICATION_CRON_SECRET:token,RESEND_API_KEY:'email-test-key',TASK_EMAIL_FROM:'SHAB <haider@shabgroup.com>',WHATSAPP_ACCESS_TOKEN:'whatsapp-test-key',WHATSAPP_PHONE_NUMBER_ID:'123456',WHATSAPP_GRAPH_VERSION:'v24.0',WHATSAPP_TASK_TEMPLATE:'shab_task_update',WHATSAPP_TEMPLATE_LANGUAGE:'en',...options.env};
  const tableData=(name)=>({task_notification_settings:{enabled:options.enabled ?? true},tasks:options.task ?? task,staff:{full_name:'Fictional Assignee'},app_user_access:{access_role:options.role ?? 'administrator',is_active:options.active ?? true}}[name]);
  const fake={auth:{getUser:async()=>({data:{user:options.invalidToken?null:{id:'test-user'}},error:options.invalidToken?{message:'bad token'}:null})},
    from(name){return {select(){return this;},eq(){return this;},single:async()=>({data:tableData(name),error:null}),maybeSingle:async()=>({data:tableData(name),error:null}),update(value){updates.push(value);return this;},then(resolve){resolve({error:null});}};},
    async rpc(name){if(name==='plan_task_notifications')return {error:null};if(name==='claim_task_notifications')return {data:[{...job,...options.job}],error:null};if(name==='task_notification_contact')return {data:[{...contact,...options.contact}],error:null};throw Error(name);}};
  const sandbox={...logic.exports,createClient:()=>fake,Deno:{env:{get:n=>vars[n]},serve:fn=>handler=fn},Response,Request,URL,Intl,Date,AbortSignal,JSON,fetch:async(url,init)=>{
    calls.push({url,init});if(options.throwFetch)throw new Error('timeout');
    return new Response(JSON.stringify(options.providerBody ?? ({id:'email-message'})),{status:options.providerStatus ?? 200});
  }};
  vm.createContext(sandbox);vm.runInContext(transpile(index),sandbox);
  const response=await handler(new Request('https://project.example.invalid/functions/v1/task-notifications',{method:options.method ?? 'POST',headers:{Authorization:options.authorization ?? `Bearer ${token}`}}));
  return {status:response.status,body:await response.json(),calls,updates};
}
let result=await run({authorization:'Bearer wrong'});assert.equal(result.status,401);assert.equal(result.calls.length,0);
result=await run({enabled:false});assert.equal(result.body.processed,0);assert.equal(result.calls.length,0);
result=await run({method:'GET',invalidToken:true});assert.equal(result.status,401);
result=await run({method:'GET',role:'operations_staff'});assert.equal(result.status,403);
result=await run({method:'GET',active:false});assert.equal(result.status,403);
result=await run({method:'GET'});assert.equal(result.status,200);assert.equal(result.body.configured.whatsapp_manual,true);assert.equal(result.calls.length,0);
result=await run({job:{channel:'whatsapp'}});assert.equal(result.updates[0].status,'cancelled');assert.equal(result.calls.length,0);
result=await run({job:{channel:'email'}});assert.equal(result.updates[0].status,'accepted');assert.equal(result.calls[0].init.headers['Idempotency-Key'],'task-alert-alert-id');
const mail=JSON.parse(result.calls[0].init.body);assert.equal(mail.from,'SHAB <haider@shabgroup.com>');assert.deepEqual(mail.cc,['umar@shabgroup.com']);
result=await run({job:{channel:'email'},contact:{email:'umar@shabgroup.com'}});assert.deepEqual(JSON.parse(result.calls[0].init.body).cc,[]);
result=await run({contact:{email_enabled:false}});assert.equal(result.updates[0].status,'blocked');assert.equal(result.calls.length,0);
result=await run({env:{RESEND_API_KEY:''}});assert.equal(result.updates[0].status,'blocked');assert.equal(result.calls.length,0);
result=await run({task:{...task,notification_revision:2}});assert.equal(result.updates[0].status,'cancelled');assert.equal(result.calls.length,0);
result=await run({task:{...task,status:'completed'}});assert.equal(result.updates[0].status,'cancelled');assert.equal(result.calls.length,0);
result=await run({throwFetch:true});assert.equal(result.updates[0].status,'unknown');
result=await run({providerStatus:429,providerBody:{error:'rate limit'}});assert.equal(result.updates[0].status,'queued');
result=await run({providerStatus:503,providerBody:{error:'unavailable'},job:{attempts:5}});assert.equal(result.updates[0].status,'failed');
result=await run({providerStatus:400,providerBody:{error:'template not approved'}});assert.equal(result.updates[0].status,'failed');
result=await run({providerBody:{}});assert.equal(result.updates[0].status,'unknown');
console.log('Task notification worker checks passed: scheduler/caller authentication, disabled sending, provider payloads, opt-out, missing configuration, stale alerts, completion, backoff, attempt limits and unknown outcomes. No real messages sent.');
