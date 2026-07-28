
UPDATE public.booking_reminder_templates
SET body = regexp_replace(regexp_replace(regexp_replace(body,
  'Advisor Link Online', 'Settled & Sound', 'gi'),
  'AdvisorLink', 'Settled & Sound', 'gi'),
  'advisorlinkonline\.com\.au', 'settledandsound.com.au', 'gi'),
    subject = CASE WHEN subject IS NULL THEN NULL ELSE regexp_replace(regexp_replace(regexp_replace(subject,
  'Advisor Link Online', 'Settled & Sound', 'gi'),
  'AdvisorLink', 'Settled & Sound', 'gi'),
  'advisorlinkonline\.com\.au', 'settledandsound.com.au', 'gi') END
WHERE body ILIKE '%advisor%' OR subject ILIKE '%advisor%';

UPDATE public.sms_templates
SET body = regexp_replace(regexp_replace(regexp_replace(body,
  'Advisor Link Online', 'Settled & Sound', 'gi'),
  'AdvisorLink', 'Settled & Sound', 'gi'),
  'advisorlinkonline\.com\.au', 'settledandsound.com.au', 'gi')
WHERE body ILIKE '%advisor%';

UPDATE public.workflows
SET name = regexp_replace(regexp_replace(name, 'Advisor Link Online', 'Settled & Sound', 'gi'), 'AdvisorLink', 'Settled & Sound', 'gi'),
    description = CASE WHEN description IS NULL THEN NULL ELSE regexp_replace(regexp_replace(regexp_replace(description,
      'Advisor Link Online', 'Settled & Sound', 'gi'),
      'AdvisorLink', 'Settled & Sound', 'gi'),
      'advisorlinkonline\.com\.au', 'settledandsound.com.au', 'gi') END,
    graph = REPLACE(REPLACE(REPLACE(graph::text,
      'Advisor Link Online', 'Settled & Sound'),
      'AdvisorLink', 'Settled & Sound'),
      'advisorlinkonline.com.au', 'settledandsound.com.au')::jsonb
WHERE name ILIKE '%advisor%' OR description ILIKE '%advisor%' OR graph::text ILIKE '%advisor%';
