UPDATE public.pipeline_stages SET position = position + 1 WHERE position BETWEEN 5 AND 7;
INSERT INTO public.pipeline_stages (name, position, color) VALUES ('Report Generated', 5, '#8B5CF6');