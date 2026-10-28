# Task email and WhatsApp notifications

## Implementation status

Implemented behind a disabled-by-default setting. No live messages are sent by installing the migration alone. This feature does not connect a WhatsApp number, register a sender or approve a WhatsApp template automatically.

## Behavior

- Assignment/reassignment: email and WhatsApp to the assigned active staff member.
- Changes to task title, description, priority, due date or active status create a new task revision and cancel obsolete pending alerts. Relevant updates notify the assignee.
- Due-soon reminder: once per revision when an active task is within 24 hours of its deadline.
- Overdue: WhatsApp to the assignee and every active application administrator. Administrator status comes from `app_user_access`, not the staff directory's job title.
- Daily follow-up: once per overdue task/revision/administrator/local day, on the first scheduler run at or after 09:00 Asia/Dubai, starting the day after the first accepted overdue alert.
- Completion: stops outstanding reminders and queues a WhatsApp completion update to administrators whose overdue WhatsApp alert was accepted by the provider.
- On Hold, deletion and rescheduling stop obsolete pending reminders. There is no separate Cancelled task state in the existing task schema; use On Hold or the app's existing deletion flow as appropriate.
- Existing overdue tasks are included on activation; pre-existing tasks do not receive a retrospective assignment message.
- Links require the recipient's normal app sign-in and retain existing task access controls.
- A missing/disabled contact becomes `blocked`, visible to administrators. It is never marked as sent. Save the corrected contact and retry that alert.

## Existing business number

Use the SHAB business number the owner selected. Before activating, confirm that it is enabled for official WhatsApp Business Platform messaging. If it is currently used in the WhatsApp Business mobile app, use the supported coexistence onboarding flow if the account is eligible. Do not delete or migrate the existing mobile account as a shortcut. Eligibility, sender identity and an approved template must be checked in WhatsApp Manager or the selected official provider.

This implementation uses Meta Cloud API directly after onboarding. No WhatsApp Web automation or personal-session access is involved. It has not been tested against SHAB's live sender because no API connection has been established for this app.

## Server deployment checklist

1. Apply `20261028073633_task_email_whatsapp_notifications.sql` after testing on staging. Run database advisors. Keep `task_notification_settings.enabled = false`.
2. Deploy `task-notifications` with platform JWT verification disabled: the POST endpoint authenticates a dedicated random scheduler secret; GET authenticates the caller's Supabase access token using `getUser` and checks the current active administrator role in the database. Do not disable its application-level checks.
3. Configure secrets only in the server environment:
   - `TASK_NOTIFICATION_CRON_SECRET`: high-entropy random secret, separate from the Supabase service key.
   - `TASK_APP_URL`: canonical production HTTPS app origin.
   - `RESEND_API_KEY`, `TASK_EMAIL_FROM`: existing/approved transactional email account with a verified sending domain. Auth invitation email limits do not provide a task-mail sending service.
   - `WHATSAPP_ACCESS_TOKEN`: production system-user access token with messaging permission.
   - `WHATSAPP_PHONE_NUMBER_ID`: ID for the existing approved business number, not the telephone number itself.
   - `WHATSAPP_GRAPH_VERSION`: currently supported Meta API version, explicitly pinned by the deployer.
   - `WHATSAPP_TASK_TEMPLATE`, `WHATSAPP_TEMPLATE_LANGUAGE`: approved template name and its exact approved language code.
   Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Never put any server secret in Vite/browser variables or commit it.
4. Approve a utility message template with one BODY text parameter, such as `SHAB task update: {{1}}. Please review the task in the SHAB app.` Template category/approval is determined by Meta. The parameter is a shortened task summary with the authenticated app link; complete task details remain in the email/app.
5. Schedule an HTTPS POST to `/functions/v1/task-notifications` every minute using `Authorization: Bearer <TASK_NOTIFICATION_CRON_SECRET>` and an empty JSON body. Hosted Supabase Cron + pg_net can do this; store the secret in Vault. A scheduler secret being configured does not prove that a cron job has been installed. Check the first actual invocation and scheduler logs before enabling.
6. In Tasks > Task email and WhatsApp alerts, save verified notification email/WhatsApp details for every active staff member and administrator. Explicitly enable the channels for intended recipients. Numbers must use international format, e.g. `+971501234567`. Do not infer administrator WhatsApp numbers from names or a different employee's record.
7. Use a controlled staging task and owner-approved test recipients to check assignment, due reminder, overdue, daily follow-up, completion, reassignment and inactive recipients. Enable production only after sender/template checks and actual email/WhatsApp receipt are confirmed. Verify access to the task through each test recipient's own login.

## Queue and history

Task events enqueue transactionally with the task row. The cron planner and unique event/recipient/channel/revision/period keys deduplicate scheduled events. Workers claim rows using `FOR UPDATE SKIP LOCKED`; each invocation processes at most five alerts. This bounds each run but means large backlogs take additional scheduler runs. Delivery timing is therefore scheduler/queue/provider dependent, not instantaneous.

`accepted` means the provider returned a message ID; it does not mean delivered or read. Webhook-based delivery/read receipts are not included. History shows the latest 50 alerts; older entries remain stored. Consider a retention policy after the team's audit requirements are agreed.

Definite HTTP 429/5xx failures retry with exponential backoff, at most five attempts. Email requests use a per-alert idempotency key. Network timeouts or crashed workers become `unknown` and are not retried automatically: WhatsApp cannot guarantee deduplication after an uncertain network result. Investigate provider logs before any manual resend. Recipient/task state is checked again before sending; a change racing the external HTTP call may still allow an already in-flight message.

## Verification

`npm run check:task-notifications` runs an isolated PGlite/Postgres schema and exercises the actual migration, recipient/access rules, task revisions, duplicate planning, completion, pauses and worker claims. Provider tests use fake HTTP requests and database responses; they never send a real message. `npm run build` and `npm run build:desktop` cover UI integration. None of these replaces the controlled live-sender acceptance test above.

References:
- https://supabase.com/docs/guides/functions/schedule-functions
- https://supabase.com/docs/guides/functions/auth
- https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-message-templates
- https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users
- https://resend.com/docs/api-reference/emails/send-email
