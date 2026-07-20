-- Admin user/team save helper.
-- Run after admin_auth.sql and roster_management.sql.

DROP FUNCTION IF EXISTS public.save_admin_user(UUID, TEXT, BIGINT, TEXT, BOOLEAN, BOOLEAN);

CREATE OR REPLACE FUNCTION public.save_admin_user(
  p_user_id UUID,
  p_display_name TEXT,
  p_team_id BIGINT DEFAULT NULL,
  p_role TEXT DEFAULT 'owner',
  p_active BOOLEAN DEFAULT TRUE,
  p_is_admin BOOLEAN DEFAULT FALSE,
  p_is_commissioner BOOLEAN DEFAULT FALSE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  cleaned_name TEXT := NULLIF(BTRIM(p_display_name), '');
  requested_commissioner BOOLEAN := COALESCE(p_is_commissioner, FALSE);
  save_as_admin BOOLEAN := COALESCE(p_is_admin, FALSE) OR COALESCE(p_is_commissioner, FALSE);
  existing_commissioner BOOLEAN := FALSE;
  commissioner_exists BOOLEAN := FALSE;
  profile_email TEXT;
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can save users.';
  END IF;

  IF p_user_id = auth.uid() AND NOT save_as_admin THEN
    RAISE EXCEPTION 'You cannot remove your own admin access.';
  END IF;

  IF cleaned_name IS NULL THEN
    RAISE EXCEPTION 'Name is required.';
  END IF;

  IF p_role NOT IN ('owner', 'co_owner') THEN
    RAISE EXCEPTION 'Invalid owner status.';
  END IF;

  SELECT COALESCE((
    SELECT au.is_commissioner
    FROM public.admin_users au
    WHERE au.user_id = p_user_id
  ), FALSE)
  INTO existing_commissioner;

  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users au
    WHERE au.is_commissioner = TRUE
  )
  INTO commissioner_exists;

  IF requested_commissioner IS DISTINCT FROM existing_commissioner
    AND commissioner_exists
    AND NOT public.is_commissioner_user(auth.uid()) THEN
    RAISE EXCEPTION 'Only commissioners can change commissioner status.';
  END IF;

  SELECT COALESCE(up.email, au.email)
  INTO profile_email
  FROM auth.users au
  LEFT JOIN public.user_profiles up ON up.user_id = au.id
  WHERE au.id = p_user_id;

  IF profile_email IS NULL THEN
    RAISE EXCEPTION 'User profile email was not found.';
  END IF;

  INSERT INTO public.user_profiles (
    user_id,
    email,
    display_name,
    username,
    updated_at
  )
  VALUES (
    p_user_id,
    profile_email,
    cleaned_name,
    profile_email,
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = EXCLUDED.display_name,
    username = EXCLUDED.username,
    updated_at = NOW();

  IF save_as_admin THEN
    INSERT INTO public.admin_users (user_id, display_name, is_commissioner)
    VALUES (p_user_id, cleaned_name, requested_commissioner)
    ON CONFLICT (user_id) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      is_commissioner = EXCLUDED.is_commissioner;
  ELSE
    DELETE FROM public.admin_users
    WHERE user_id = p_user_id;
  END IF;

  UPDATE public.team_owner_users
  SET active = FALSE
  WHERE user_id = p_user_id;

  IF p_team_id IS NOT NULL THEN
    INSERT INTO public.team_owner_users (
      user_id,
      owner_email,
      owner_name,
      team_id,
      role,
      active,
      season_id
    )
    VALUES (
      p_user_id,
      profile_email,
      cleaned_name,
      p_team_id,
      p_role,
      p_active,
      NULL
    )
    ON CONFLICT (user_id, team_id, season_id) DO UPDATE SET
      owner_email = EXCLUDED.owner_email,
      owner_name = EXCLUDED.owner_name,
      role = EXCLUDED.role,
      active = EXCLUDED.active;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_admin_user(UUID, TEXT, BIGINT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN)
TO authenticated;

UPDATE public.user_profiles up
SET
  display_name = latest_owner_name.owner_name,
  updated_at = NOW()
FROM (
  SELECT DISTINCT ON (tou.user_id)
    tou.user_id,
    tou.owner_name
  FROM public.team_owner_users tou
  WHERE NULLIF(BTRIM(tou.owner_name), '') IS NOT NULL
  ORDER BY tou.user_id, tou.active DESC, tou.created_at DESC
) latest_owner_name
WHERE up.user_id = latest_owner_name.user_id
  AND NULLIF(BTRIM(up.display_name), '') IS NULL;

CREATE OR REPLACE VIEW public_user_admin
WITH (security_invoker = true) AS
WITH latest_owner_name AS (
  SELECT DISTINCT ON (tou.user_id)
    tou.user_id,
    tou.owner_name
  FROM team_owner_users tou
  WHERE NULLIF(BTRIM(tou.owner_name), '') IS NOT NULL
  ORDER BY tou.user_id, tou.active DESC, tou.created_at DESC
)
SELECT
  up.user_id,
  up.email,
  COALESCE(NULLIF(BTRIM(up.display_name), ''), latest_owner_name.owner_name) AS display_name,
  up.username,
  up.created_at,
  public.is_admin_user(up.user_id) AS is_admin,
  public.is_commissioner_user(up.user_id) AS is_commissioner
FROM user_profiles up
LEFT JOIN latest_owner_name ON latest_owner_name.user_id = up.user_id;

GRANT SELECT ON public_user_admin TO authenticated;
