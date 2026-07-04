-- Optional admin support for authenticated team editing drafts.
-- Run after supabase/schema.sql.

CREATE TABLE IF NOT EXISTS admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT NULL,
  username TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS team_admin_drafts (
  draft_key TEXT PRIMARY KEY,
  draft_data JSONB NOT NULL,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_admin_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can create own profile" ON user_profiles;
CREATE POLICY "Users can create own profile"
ON user_profiles
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can read own profile" ON user_profiles;
CREATE POLICY "Users can read own profile"
ON user_profiles
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM admin_users au
    WHERE au.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile"
ON user_profiles
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM admin_users au
    WHERE au.user_id = auth.uid()
  )
)
WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM admin_users au
    WHERE au.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admins can read admin users" ON admin_users;
CREATE POLICY "Admins can read admin users"
ON admin_users
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM admin_users au
    WHERE au.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admins can insert admin users" ON admin_users;
CREATE POLICY "Admins can insert admin users"
ON admin_users
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM admin_users au
    WHERE au.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admins can update admin users" ON admin_users;
CREATE POLICY "Admins can update admin users"
ON admin_users
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM admin_users au
    WHERE au.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM admin_users au
    WHERE au.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admins can delete admin users" ON admin_users;
CREATE POLICY "Admins can delete admin users"
ON admin_users
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM admin_users au
    WHERE au.user_id = auth.uid()
  )
);

CREATE OR REPLACE VIEW public_user_admin
WITH (security_invoker = true) AS
SELECT
  up.user_id,
  up.email,
  up.display_name,
  up.username,
  up.created_at,
  au.user_id IS NOT NULL AS is_admin
FROM user_profiles up
LEFT JOIN admin_users au ON au.user_id = up.user_id;

GRANT SELECT ON public_user_admin TO authenticated;

DROP POLICY IF EXISTS "Admins can read team drafts" ON team_admin_drafts;
CREATE POLICY "Admins can read team drafts"
ON team_admin_drafts
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM admin_users au
    WHERE au.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admins can upsert team drafts" ON team_admin_drafts;
CREATE POLICY "Admins can upsert team drafts"
ON team_admin_drafts
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM admin_users au
    WHERE au.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admins can update team drafts" ON team_admin_drafts;
CREATE POLICY "Admins can update team drafts"
ON team_admin_drafts
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM admin_users au
    WHERE au.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
  FROM admin_users au
  WHERE au.user_id = auth.uid()
  )
);
