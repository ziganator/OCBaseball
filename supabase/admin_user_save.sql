-- Admin user/team save helper.
-- Run after admin_auth.sql and roster_management.sql.

CREATE OR REPLACE FUNCTION public.save_admin_user(
  p_user_id UUID,
  p_display_name TEXT,
  p_team_id BIGINT DEFAULT NULL,
  p_role TEXT DEFAULT 'owner',
  p_active BOOLEAN DEFAULT TRUE,
  p_is_admin BOOLEAN DEFAULT FALSE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  cleaned_name TEXT := NULLIF(BTRIM(p_display_name), '');
  profile_email TEXT;
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can save users.';
  END IF;

  IF p_user_id = auth.uid() AND NOT p_is_admin THEN
    RAISE EXCEPTION 'You cannot remove your own admin access.';
  END IF;

  IF cleaned_name IS NULL THEN
    RAISE EXCEPTION 'Name is required.';
  END IF;

  IF p_role NOT IN ('owner', 'co_owner') THEN
    RAISE EXCEPTION 'Invalid owner status.';
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

  IF p_is_admin THEN
    INSERT INTO public.admin_users (user_id, display_name)
    VALUES (p_user_id, cleaned_name)
    ON CONFLICT (user_id) DO UPDATE SET
      display_name = EXCLUDED.display_name;
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

GRANT EXECUTE ON FUNCTION public.save_admin_user(UUID, TEXT, BIGINT, TEXT, BOOLEAN, BOOLEAN)
TO authenticated;
