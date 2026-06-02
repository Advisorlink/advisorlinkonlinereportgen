WITH batch AS (
  SELECT d.id, d.position,
         ROW_NUMBER() OVER (ORDER BY d.position ASC) AS old_rank,
         COUNT(*) OVER () AS total
  FROM public.pipeline_deals d
  JOIN public.pipeline_stages s ON s.id = d.stage_id
  WHERE s.name ILIKE 'New Lead'
    AND d.created_at = '2026-06-02 03:28:30.663738+00'
),
mn AS (
  SELECT MIN(position) AS minpos FROM batch
)
UPDATE public.pipeline_deals p
SET position = (SELECT minpos FROM mn) + (b.total - b.old_rank)
FROM batch b
WHERE p.id = b.id;