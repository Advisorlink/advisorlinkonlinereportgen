
-- Move deals from Contacted to New Lead before deletion
UPDATE public.pipeline_deals SET stage_id = 'e25de917-0375-4c8b-81af-0f6c2169abd5' WHERE stage_id = '1c167b87-1f9c-4278-996a-335bacd9ce41';

-- Delete Contacted and Fact Find stages
DELETE FROM public.pipeline_stages WHERE id IN ('1c167b87-1f9c-4278-996a-335bacd9ce41','41ad65d4-7bd6-46a9-8df1-7f254ad0d54a');

-- Rename New Lead to New Leads
UPDATE public.pipeline_stages SET name = 'New Leads' WHERE id = 'e25de917-0375-4c8b-81af-0f6c2169abd5';

-- Reorder stages
UPDATE public.pipeline_stages SET position = 0 WHERE id = 'e25de917-0375-4c8b-81af-0f6c2169abd5'; -- New Leads
UPDATE public.pipeline_stages SET position = 1 WHERE id = 'd7c2eef8-c8e4-4deb-999b-480846e62b2d'; -- Next Call Due
UPDATE public.pipeline_stages SET position = 2 WHERE id = 'ebaadd8e-1f47-40f3-9548-b7d38c134d6e'; -- Report Generated
UPDATE public.pipeline_stages SET position = 3 WHERE id = 'd7c6d95e-e3ed-4ab7-83b2-8e01a2aaa36b'; -- Report Sent
UPDATE public.pipeline_stages SET position = 4 WHERE id = 'd8606fcc-65e4-4e9a-bd6e-81a36ad72fad'; -- Meeting Booked
UPDATE public.pipeline_stages SET position = 5 WHERE id = '234009c0-a0d9-426a-b1a0-1836dabec35a'; -- Signed
UPDATE public.pipeline_stages SET position = 6 WHERE id = 'b671d1fa-1e44-4182-8148-6ebc00237cac'; -- Settled
UPDATE public.pipeline_stages SET position = 7 WHERE id = '70ec9ded-d7af-48d8-9f7b-2903d337136a'; -- Won
UPDATE public.pipeline_stages SET position = 8 WHERE id = 'a62cccaa-8fe3-4031-88dd-8775a8ccc2a3'; -- Lost
UPDATE public.pipeline_stages SET position = 9 WHERE id = 'd7d008ac-5796-4f74-9765-6230a9e65fe8'; -- Did Not Answer
UPDATE public.pipeline_stages SET position = 10 WHERE id = '53b899b9-4d2f-4569-a125-108677c9c9b9'; -- Do Not Contact
