# Task notifications: in-app, email and manual WhatsApp

## Agreed workflow

The owner selected an alternative that does not require Meta API onboarding:

- Detailed in-app alerts for the assigned staff member.
- Overdue task alerts for every active app administrator, refreshed with a new unread identity daily at 09:00 Asia/Dubai. These appear when the app is open/connected; they are not operating-system push notifications.
- Email assignments, reminders, overdue escalation and follow-ups after a transactional email sender and scheduler are connected.
- An administrator action on each task opens a recipient chooser and prepares a WhatsApp message. The person reviews the message in WhatsApp and presses Send. Use the SHAB WhatsApp account (+971 54 292 2855). A link cannot force which WhatsApp account the device uses.

**Automatic WhatsApp delivery is disabled in this version. Meta verification is not a prerequisite for in-app alerts or the manual WhatsApp action.** Existing pending WhatsApp queue entries are cancelled by the follow-up migration and rejected by the worker.

## In-app alerts

`get_my_task_alerts()` is a SECURITY INVOKER RPC. It reads the current signed-in access profile and task/staff records under the existing RLS policies. Operations staff receive their own active assigned tasks; administrators additionally receive overdue tasks across the practice. The current task revision and recipient are included in each notification identity. Held/completed tasks disappear, and reassignments stop appearing for the previous assignee. Up to 50 detailed task alerts are shown alongside the existing summary notifications.

The notification bell refreshes on task realtime changes and every minute while the app is visible and online. No cron job, external messaging provider or sending toggle is needed for this in-app feed. Read state uses the app's existing browser-local notification state; it does not sync between devices.

## Manual WhatsApp

Administrators see a WhatsApp action in Tasks. For an active overdue task the chooser includes the assigned active staff member and all active administrators; for other tasks it includes the assigned active staff member. Missing or invalid international numbers are flagged. Contacts are read from the existing administrator-protected recipient settings. The message contains the title, description, assignee, status, priority, UAE deadline and authenticated app link.

Opening WhatsApp is not recorded as a sent or delivered message. No message is sent automatically, no API credentials are needed, and recipients are selected explicitly. Never describe this button as automatic delivery.

## Email settings and remaining activation

- Sender requested by owner: `haider@shabgroup.com`.
- Every task email copies `umar@shabgroup.com`; duplicate CC is omitted when Umar is the main recipient.
- In-app/manual features work while the email sending setting is off.
- Email requires a verified sending domain/account, server-side `RESEND_API_KEY` and `TASK_EMAIL_FROM=SHAB <haider@shabgroup.com>`, plus a scheduler. This connection is not established merely because the backend is deployed.
- The Tasks administrator panel controls email alerts separately and exposes configuration, contacts and recent provider-acceptance/failure history. Save each active recipient's email/channel setting before activation.

## Server deployment

Apply migrations in order:
1. `20261028073633_task_email_whatsapp_notifications.sql` (initial queue; already installed disabled on 28 October 2026).
2. `20261028093440_task_in_app_manual_whatsapp.sql` (current email-only queue and independent in-app feed).

Deploy `task-notifications` with platform JWT verification off. Application-level authentication remains mandatory: GET validates a Supabase access token using `getUser` and checks the current active administrator role; POST requires a dedicated random scheduler secret. Browser clients cannot submit destinations or message contents. The initial function was installed disabled on 28 October; redeploy the revised email-only source with this migration.

Secrets, only in the server environment:
- `RESEND_API_KEY`, `TASK_EMAIL_FROM` as above.
- `TASK_NOTIFICATION_CRON_SECRET`: a high-entropy random secret, separate from the service key.
- `TASK_APP_URL`: canonical HTTPS app origin.
- Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

Schedule POST `/functions/v1/task-notifications` every minute using `Authorization: Bearer <TASK_NOTIFICATION_CRON_SECRET>`. Hosted Supabase Cron + pg_net can invoke it; store the secret in Vault. A configured secret is not proof that a cron job is installed. Verify a controlled email receipt and scheduler invocation before enabling production email alerts. Existing overdue tasks are included when email sending is enabled.

## Delivery history

Email uses transactional task revisions, unique event keys, locked queue claims, five alerts per invocation, bounded backoff and per-alert idempotency keys. `accepted` means the provider returned a message ID, not that an inbox/device received or read it. Timeouts/crashed workers become `unknown` and are not blindly retried. Review provider logs first. No email/WhatsApp delivery webhooks are included.

## Verification

`npm run check:task-notifications` runs isolated PostgreSQL/PGlite tests against both actual migrations and mocked email provider tests. It covers recipient/access rules, task revisions, scheduling, completion/hold/reassignment, queue deduplication, manual WhatsApp links and rejection of automated WhatsApp jobs. No real messages are sent by tests. Web/desktop builds, behavior, navigation, localization and realtime checks cover integration. A controlled live email acceptance test remains necessary before enabling emails.
