-- Delete duplicate pipeline_deals by client_phone, keep oldest
WITH ranked AS (
  SELECT id, created_at,
         row_number() OVER (PARTITION BY client_phone ORDER BY created_at ASC, id ASC) AS rn
  FROM pipeline_deals
  WHERE client_phone IS NOT NULL AND client_phone <> ''
)
DELETE FROM pipeline_deals d
USING ranked r
WHERE d.id = r.id AND r.rn > 1;

-- Repopulate sheet_lead_imports with all current phone digits so syncs treat them as already-imported
INSERT INTO sheet_lead_imports (spreadsheet_id, sheet_name, phone_digits, client_name, deal_id)
SELECT
  (SELECT spreadsheet_id FROM sheet_lead_sync_config WHERE id = 1),
  (SELECT sheet_name FROM sheet_lead_sync_config WHERE id = 1),
  regexp_replace(client_phone, '\D', '', 'g'),
  client_name,
  id
FROM pipeline_deals
WHERE client_phone IS NOT NULL AND client_phone <> ''
ON CONFLICT (spreadsheet_id, sheet_name, phone_digits) DO NOTHING;