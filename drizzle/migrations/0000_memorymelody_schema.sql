CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'Untitled memory',
  mood text, genre text, vocal text, language text DEFAULT 'English',
  length_sec integer DEFAULT 30,
  context text DEFAULT '',
  consent boolean NOT NULL DEFAULT false,
  consent_at timestamptz,
  experience_summary text,
  concept text,
  lyrics text,
  music_prompt text,
  audio_path text,
  audio_status text NOT NULL DEFAULT 'none',
  audio_error text,
  rights_checklist jsonb NOT NULL DEFAULT '{}'::jsonb,
  release jsonb NOT NULL DEFAULT '{}'::jsonb,
  cover_path text,
  distribution_status text NOT NULL DEFAULT 'draft',
  stage text NOT NULL DEFAULT 'memories',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own projects select" ON public.projects FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own projects insert" ON public.projects FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own projects update" ON public.projects FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own projects delete" ON public.projects FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.project_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  storage_path text NOT NULL,
  kind text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL DEFAULT 0,
  file_name text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_media TO authenticated;
GRANT ALL ON public.project_media TO service_role;
ALTER TABLE public.project_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own media select" ON public.project_media FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own media insert" ON public.project_media FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid()));
CREATE POLICY "own media update" ON public.project_media FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own media delete" ON public.project_media FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.user_settings (
  user_id uuid PRIMARY KEY,
  text_provider text NOT NULL DEFAULT 'lovable-ai',
  music_provider text NOT NULL DEFAULT 'lovable-lyria',
  distributor text NOT NULL DEFAULT 'none',
  spotify_artist_url text,
  default_artist_name text,
  onboarded boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings TO authenticated;
GRANT ALL ON public.user_settings TO service_role;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own settings all" ON public.user_settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER projects_touch BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER settings_touch BEFORE UPDATE ON public.user_settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "own files select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id IN ('media','audio','covers') AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own files insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id IN ('media','audio','covers') AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own files update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id IN ('media','audio','covers') AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own files delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id IN ('media','audio','covers') AND (storage.foldername(name))[1] = auth.uid()::text);