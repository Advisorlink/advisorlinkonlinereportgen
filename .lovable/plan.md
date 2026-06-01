## What you'll get

A paced campaign engine for the AI Voice Caller so you can drop in 500 numbers and let it dial through them safely.

### How a campaign will run

1. **Upload your 500 contacts** to a campaign (as you do today).
2. **Set pacing rules per campaign** (new settings panel on the campaign):
   - **Max calls per hour** — default 50
   - **Minimum gap between calls** — default 3 min (timer starts when the previous call *ends*, not when it starts)
   - **Daily call window** — default 9:00 AM → 5:00 PM (Australia/Sydney)
   - **Days of week** — default Mon–Fri
3. **Hit Start.** The campaign goes `active` but no calls fire immediately.
4. **A background ticker runs every minute.** It looks at every active campaign and asks:
   - Are we inside the daily window?
   - Has the per-hour cap been hit in the last 60 minutes?
   - Has it been at least 3 min since the last call on this campaign finished?
   - Are there pending contacts left?
   - If yes to all → fire **one** call to the next pending contact.
5. At **5:00 PM** the ticker stops firing. Any in-flight call finishes naturally. At 9:00 AM next business day it resumes from where it left off.
6. When the contact list is exhausted, the campaign auto-completes.

### What you'll see in the dashboard

The Campaigns page will get a live status card per active campaign:

- **Progress bar**: `127 / 500 called` (25%)
- **Today's pace**: `34 calls in the last hour · 8 min until next call`
- **Outcomes breakdown** (live):
  - ✅ Answered & qualified → Pipeline (New Lead)
  - 📞 Answered, not interested → Do Not Contact
  - 📭 No answer / voicemail → Did Not Answer
  - ❌ Failed (bad number, etc.)
- **Window status**: "Calling until 5:00 PM" or "Paused — resumes Mon 9:00 AM"
- **Per-contact table** with: name, phone, attempts, last call status, duration, outcome, link to transcript

You can **Pause / Resume / Stop** any campaign with one button. Pause keeps it in place; Stop ends it.

### Re-dial the "Did Not Answer" pile

A new button **"Re-dial Did Not Answer"** on the campaign creates a fresh campaign pre-loaded with everyone who didn't pick up, so you can run them through again later with the same pacing rules.

---

### Technical section

**Schema additions** (`ai_caller_campaigns`)
- `calls_per_hour int default 50`
- `min_gap_seconds int default 180`
- `daily_start_time time default '09:00'`
- `daily_end_time time default '17:00'`
- `active_days int[] default '{1,2,3,4,5}'` (1=Mon)
- `timezone text default 'Australia/Sydney'`
- `last_call_finished_at timestamptz` (updated when webhook reports call ended)

**New edge function `vapi-campaign-tick`** (cron every 60s via `pg_cron` + `pg_net`)
- For each `status='active'` campaign:
  - Check window (timezone-aware) → skip if outside
  - Count `ai_caller_call_logs` rows in last 1h → skip if >= `calls_per_hour`
  - Check `now() - last_call_finished_at >= min_gap_seconds` → skip if not
  - Skip if any in-flight call (`status in ('initiated','ringing','in-progress')`) for this campaign
  - Pick next `ai_caller_contacts` row where `call_status='pending'` → fire 1 call
  - Mark campaign `completed` when no pending contacts remain

**Existing `start-campaign` action** — change from loop-fire to "mark active + first tick". Drop the inline 2-second loop.

**`vapi-webhook` end-of-call hook** — already exists; add an update to `ai_caller_campaigns.last_call_finished_at = now()` so the ticker can pace correctly.

**Frontend** (`AICallerCampaigns.tsx` + new `CampaignSettingsDialog.tsx`)
- Settings form for the 5 pacing fields (with sensible defaults)
- Live status card (polls every 15s)
- Outcome counts via aggregating `ai_caller_call_logs` joined to `pipeline_deals.stage_id`
- "Re-dial Did Not Answer" → creates new campaign from contacts whose latest call routed to the Did Not Answer stage

**Cron**
```sql
select cron.schedule(
  'vapi-campaign-tick',
  '* * * * *',
  $$ select net.http_post(
       url:='https://osqreiyssdhpplxtcxdv.supabase.co/functions/v1/vapi-campaign-tick',
       headers:='{"Content-Type":"application/json","apikey":"<anon>"}'::jsonb
     ); $$
);
```

---

### Order of work

1. Migration: add pacing columns + cron job
2. Build `vapi-campaign-tick` edge function
3. Wire `last_call_finished_at` update into `vapi-webhook`
4. Refactor `start-campaign` to non-blocking
5. Frontend: settings dialog + live status card + outcome table
6. "Re-dial Did Not Answer" button
7. End-to-end test with a 5-contact campaign and a 30-second gap to validate pacing

Approve and I'll build it.