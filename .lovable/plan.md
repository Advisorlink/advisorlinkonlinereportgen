## Two new systems

### 1. Two-way Google Calendar sync

Right now bookings push to your Google Calendar, but if you edit or delete the event in Google Calendar, nothing happens back in the app. We need GCal → app sync.

**How it works**
- Subscribe to Google Calendar push notifications (watch channel) on your primary calendar. Google pings our edge function whenever anything changes.
- New edge function `gcal-webhook` receives the ping, pulls the changed events since the last sync token, and for any event linked to a booking (`google_event_id` match):
  - **Time changed** → update `bookings.start_at` / `end_at`, mark `status='rescheduled'`, clear reminder timestamps so 24h/1h reminders re-fire, send the client the branded "rescheduled" email + SMS.
  - **Event deleted/cancelled** → mark booking `status='cancelled'`, send branded cancellation email + SMS, free the slot.
  - **Attendee changed / title changed** → just sync the fields, no notifications.
- Channels expire after ~7 days, so a daily cron (`gcal-watch-refresh`) renews them.
- Store the channel id, resource id, and sync token in a new tiny table `gcal_sync_state`.

**What you'll see**
- Drag a meeting in Google Calendar → within seconds the Bookings list updates, the client gets a "rescheduled" email + SMS, and reminders reset for the new time.
- Delete it in GCal → booking shows as Cancelled, client gets the cancellation email.

---

### 2. Visual workflow builder (drag-and-drop automation tree)

A new **Automations** tab (inside the Messages page, as you suggested) with a canvas where you drag nodes to build flows.

**Node types**
- **Triggers** (the green start node — pick one):
  - Report generated
  - Report sent
  - Pipeline stage changed (pick stage, e.g. "Presentation Booked", "Report Sent")
  - Booking created / rescheduled / cancelled
  - Form submitted (referral, fact find)
- **Actions**:
  - Send email (pick a template, edit subject/body with merge fields like `{{client_name}}`, `{{meeting_link}}`)
  - Send SMS (same merge fields)
  - Move deal to pipeline stage
  - Create booking reminder
  - Webhook (POST to a URL)
- **Logic**:
  - Wait (seconds / minutes / hours / days)
  - Condition / branch (if email opened, if has phone, if value > X — yes/no branches)
- **End**: stop node.

**Canvas**
- Built with React Flow (industry standard, drag-drop, snap-to-grid, mini-map, zoom). Nodes have ports, you drag connections between them.
- Save loads a JSON graph from a new `workflows` table.
- Click any node to open a side panel and edit its config (template body, wait duration, condition rules).
- Toggle to enable/disable a workflow.

**How runs work**
- When a trigger event fires anywhere in the app, we call `workflow-trigger` edge function with `(trigger_type, context)`.
- It finds matching enabled workflows, creates a `workflow_run` row, and queues the first step.
- Cron `workflow-tick` runs every minute, picks up runs whose `next_run_at <= now()`, executes the current node (send email, evaluate condition, etc.), advances to the next node, and sets the next `next_run_at` (now + wait duration, or now for instant nodes).
- Each step is logged to `workflow_run_steps` so you can see what happened per client.

**What you'll see**
- New **Messages → Automations** tab with a list of workflows + "New workflow" button.
- Builder page with the React Flow canvas, node palette on the left, properties panel on the right.
- A **Runs** sub-tab showing in-flight and completed runs, with the timeline of each.

---

### Technical section

**New tables**
- `gcal_sync_state` — channel_id, resource_id, sync_token, expires_at
- `workflows` — name, trigger_type, trigger_config (jsonb), graph (jsonb: nodes + edges), is_active
- `workflow_runs` — workflow_id, trigger_context (jsonb: client info), current_node_id, status (`running`/`completed`/`failed`/`cancelled`), next_run_at
- `workflow_run_steps` — run_id, node_id, node_type, executed_at, result (jsonb), error

**New edge functions**
- `gcal-webhook` (public, no JWT) — receives Google push notifications, syncs changed events to bookings, sends reschedule/cancel emails + SMS reusing existing branded templates from `_shared/booking-utils.ts`.
- `gcal-watch-register` — creates/refreshes the push channel on primary calendar. Runs once at install + daily via cron.
- `workflow-trigger` — called from app code (after report sent, booking created, pipeline move, etc.). Spawns runs.
- `workflow-tick` — cron every minute, advances runs.

**Cron**
- `gcal-watch-refresh` daily — refresh the watch channel before it expires
- `workflow-tick` every minute

**Frontend**
- `src/pages/Messages.tsx` — add **Automations** tab
- `src/components/automations/WorkflowList.tsx` — list + new
- `src/components/automations/WorkflowBuilder.tsx` — React Flow canvas
- `src/components/automations/nodes/*` — custom node components (TriggerNode, EmailNode, SmsNode, WaitNode, ConditionNode, etc.)
- `src/components/automations/WorkflowRuns.tsx` — run history viewer
- `react-flow` (now `@xyflow/react`) added to deps

**App hooks** (places we fire `workflow-trigger`)
- `send-report-email` edge function on success
- `pipeline-auto.ts moveDealToStage` on every stage change
- `booking-create` / `booking-reschedule` / `booking-cancel` / `gcal-webhook` on every booking change

---

### Order of work

1. Migration: `gcal_sync_state`, `workflows`, `workflow_runs`, `workflow_run_steps` + crons
2. GCal two-way sync (webhook + watch register + refresh cron)
3. Workflow engine (trigger + tick edge functions)
4. Wire up trigger calls across the app (report sent, pipeline moves, bookings)
5. Frontend: Automations tab + React Flow builder + node config panels
6. Runs viewer
7. End-to-end test
