
INSERT INTO storage.buckets (id, name, public) VALUES ('sms-media', 'sms-media', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "SMS media public read" ON storage.objects FOR SELECT USING (bucket_id = 'sms-media');
CREATE POLICY "Authenticated can upload sms-media" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'sms-media' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own sms-media" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'sms-media' AND auth.uid()::text = (storage.foldername(name))[1]);
