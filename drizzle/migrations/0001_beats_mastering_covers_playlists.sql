ALTER TABLE public.projects
  ADD COLUMN beat_source text NOT NULL DEFAULT 'none',
  ADD COLUMN beat_path text,
  ADD COLUMN beat_file_name text,
  ADD COLUMN beat_mime text,
  ADD COLUMN beat_status text NOT NULL DEFAULT 'none',
  ADD COLUMN beat_error text,
  ADD COLUMN beat_rights jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN mastered_path text,
  ADD COLUMN mastering_status text NOT NULL DEFAULT 'none',
  ADD COLUMN mastering_engine text,
  ADD COLUMN mastering_source text,
  ADD COLUMN mastering_error text,
  ADD COLUMN cover_source text,
  ADD COLUMN cover_art_path text,
  ADD COLUMN cover_text jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN cover_status text NOT NULL DEFAULT 'none',
  ADD COLUMN cover_error text,
  ADD COLUMN package_exported_at timestamptz;

CREATE TABLE public.playlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  title text NOT NULL DEFAULT 'Untitled playlist',
  description text,
  cover_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.playlists TO authenticated;
GRANT ALL ON public.playlists TO service_role;
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own playlists all" ON public.playlists FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.playlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id uuid NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (playlist_id, project_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.playlist_items TO authenticated;
GRANT ALL ON public.playlist_items TO service_role;
ALTER TABLE public.playlist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own items select" ON public.playlist_items FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own items insert" ON public.playlist_items FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (SELECT 1 FROM public.playlists pl WHERE pl.id = playlist_id AND pl.user_id = auth.uid())
  AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid()));
CREATE POLICY "own items update" ON public.playlist_items FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own items delete" ON public.playlist_items FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX playlist_items_playlist_idx ON public.playlist_items (playlist_id, position);