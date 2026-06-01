INSERT INTO public.pipeline_stages (name, position, color)
SELECT 'Did Not Answer', 11, '#F59E0B'
WHERE NOT EXISTS (SELECT 1 FROM public.pipeline_stages WHERE name = 'Did Not Answer');

INSERT INTO public.pipeline_stages (name, position, color)
SELECT 'Do Not Contact', 12, '#6B7280'
WHERE NOT EXISTS (SELECT 1 FROM public.pipeline_stages WHERE name = 'Do Not Contact');