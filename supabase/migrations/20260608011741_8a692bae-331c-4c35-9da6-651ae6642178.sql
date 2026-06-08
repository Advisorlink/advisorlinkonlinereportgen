ALTER TABLE public.booking_settings ADD COLUMN slot_interval_minutes integer NOT NULL DEFAULT 30;

UPDATE public.booking_settings SET slot_interval_minutes = 30 WHERE slot_interval_minutes IS NULL;

COMMENT ON COLUMN public.booking_settings.slot_interval_minutes IS 'Minutes between consecutive offered booking slots (e.g. 30 for 2:00, 2:30, 3:00)';
