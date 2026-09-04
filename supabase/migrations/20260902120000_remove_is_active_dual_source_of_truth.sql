-- Migration: Remove is_active from user_roles and set profiles.institution_id as single source of truth

-- 1. Drop dependent indexes if they exist
DROP INDEX IF EXISTS public.idx_user_roles_user_active;
DROP INDEX IF EXISTS public.idx_user_roles_one_active;

-- 2. Drop is_active column from user_roles table
ALTER TABLE public.user_roles DROP COLUMN IF EXISTS is_active;

-- 3. Update get_user_institution to fetch directly from profiles table
CREATE OR REPLACE FUNCTION public.get_user_institution(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT institution_id
  FROM public.profiles
  WHERE user_id = _user_id
  LIMIT 1;
$$;

-- 4. Rewrite switch_active_institution to only update profiles.institution_id
CREATE OR REPLACE FUNCTION public.switch_active_institution(_institution_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Ensure user has an approved role in the requested institution
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
      AND institution_id = _institution_id
      AND status = 'approved'::membership_status
  ) THEN
    RAISE EXCEPTION 'Not an approved member of this institution';
  END IF;

  UPDATE public.profiles
  SET institution_id = _institution_id
  WHERE user_id = auth.uid();
END;
$$;

-- 5. Update create_institution_for_current_user without is_active
CREATE OR REPLACE FUNCTION public.create_institution_for_current_user(_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_slug text;
  new_slug text;
  new_institution_id uuid;
BEGIN
  IF _name IS NULL OR length(trim(_name)) = 0 THEN
    RAISE EXCEPTION 'Institution name is required';
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  base_slug := regexp_replace(lower(trim(_name)), '\s+', '-', 'g');
  base_slug := regexp_replace(base_slug, '[^a-z0-9-]', '', 'g');
  new_slug := base_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

  INSERT INTO public.institutions (name, slug, welcome_text)
  VALUES (trim(_name), new_slug, 'Welcome to ' || trim(_name) || ' verification portal')
  RETURNING id INTO new_institution_id;

  INSERT INTO public.user_roles (user_id, role, institution_id, status)
  VALUES (auth.uid(), 'admin'::app_role, new_institution_id, 'approved'::membership_status);

  UPDATE public.profiles
  SET institution_id = new_institution_id
  WHERE user_id = auth.uid();

  RETURN new_institution_id;
END;
$$;

-- 6. Update join_institution_for_current_user without is_active
CREATE OR REPLACE FUNCTION public.join_institution_for_current_user(_institution_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _institution_id IS NULL THEN
    RAISE EXCEPTION 'Institution id is required';
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.institutions WHERE id = _institution_id) THEN
    RAISE EXCEPTION 'Institution not found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND institution_id = _institution_id
  ) THEN
    RAISE EXCEPTION 'Request to join this institution has already been submitted or joined.';
  END IF;

  INSERT INTO public.user_roles (user_id, role, institution_id, status)
  VALUES (auth.uid(), 'user'::app_role, _institution_id, 'pending'::membership_status);
END;
$$;

-- 7. Update get_user_institutions function without is_active
DROP FUNCTION IF EXISTS public.get_user_institutions(uuid);
CREATE OR REPLACE FUNCTION public.get_user_institutions(_user_id uuid)
RETURNS TABLE (
  institution_id uuid,
  institution_name text,
  institution_slug text,
  role app_role,
  status membership_status
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    ur.institution_id,
    i.name as institution_name,
    i.slug as institution_slug,
    ur.role,
    ur.status
  FROM public.user_roles ur
  JOIN public.institutions i ON i.id = ur.institution_id
  WHERE ur.user_id = _user_id AND ur.institution_id IS NOT NULL
  ORDER BY i.name ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_institution(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_institutions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.switch_active_institution(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_institution_for_current_user(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_institution_for_current_user(uuid) TO authenticated;
