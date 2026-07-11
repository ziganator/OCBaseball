-- Published public team page data.
-- Run after supabase/admin_auth.sql.

CREATE TABLE IF NOT EXISTS team_site_data (
  data_key TEXT PRIMARY KEY,
  site_data JSONB NOT NULL,
  updated_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE team_site_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read published team site data" ON team_site_data;
CREATE POLICY "Public can read published team site data"
ON team_site_data FOR SELECT TO anon, authenticated
USING (TRUE);

DROP POLICY IF EXISTS "Admins can insert published team site data" ON team_site_data;
CREATE POLICY "Admins can insert published team site data"
ON team_site_data FOR INSERT TO authenticated
WITH CHECK (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admins can update published team site data" ON team_site_data;
CREATE POLICY "Admins can update published team site data"
ON team_site_data FOR UPDATE TO authenticated
USING (public.is_admin_user(auth.uid()))
WITH CHECK (public.is_admin_user(auth.uid()));

GRANT SELECT ON team_site_data TO anon, authenticated;
GRANT INSERT, UPDATE ON team_site_data TO authenticated;
