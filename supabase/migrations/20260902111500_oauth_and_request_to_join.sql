-- Create enum for membership status
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'membership_status') THEN
    CREATE TYPE public.membership_status AS ENUM ('pending', 'approved', 'rejected');
  END IF;
END $$;

-- Add status column to user_roles
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS status public.membership_status NOT NULL DEFAULT 'pending';

-- Update existing user_roles records to 'approved'
UPDATE public.user_roles SET status = 'approved' WHERE status IS NULL OR status = 'pending';

-- Update create_institution_for_current_user to set status = 'approved'
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

  UPDATE public.user_roles
  SET is_active = false
  WHERE user_id = auth.uid();

  INSERT INTO public.user_roles (user_id, role, institution_id, is_active, status)
  VALUES (auth.uid(), 'admin'::app_role, new_institution_id, true, 'approved'::membership_status);

  UPDATE public.profiles
  SET institution_id = new_institution_id
  WHERE user_id = auth.uid();

  RETURN new_institution_id;
END;
$$;

-- Update join_institution_for_current_user to default status to 'pending' and is_active = false
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

  INSERT INTO public.user_roles (user_id, role, institution_id, is_active, status)
  VALUES (auth.uid(), 'user'::app_role, _institution_id, false, 'pending'::membership_status);
END;
$$;

-- Function for Admin to update member status (approve/reject)
CREATE OR REPLACE FUNCTION public.update_member_status(_target_user_id uuid, _institution_id uuid, _new_status membership_status)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if caller is super admin OR an approved admin of the institution
  IF NOT (
    public.is_super_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND institution_id = _institution_id
        AND role = 'admin'::app_role
        AND status = 'approved'::membership_status
    )
  ) THEN
    RAISE EXCEPTION 'Only institution administrators can update member status';
  END IF;

  UPDATE public.user_roles
  SET status = _new_status
  WHERE user_id = _target_user_id AND institution_id = _institution_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_member_status(uuid, uuid, membership_status) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_member_status(uuid, uuid, membership_status) TO authenticated;

-- Update get_user_institutions to return status
DROP FUNCTION IF EXISTS public.get_user_institutions(uuid);
CREATE OR REPLACE FUNCTION public.get_user_institutions(_user_id uuid)
RETURNS TABLE (
  institution_id uuid,
  institution_name text,
  institution_slug text,
  role app_role,
  is_active boolean,
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
    ur.is_active,
    ur.status
  FROM public.user_roles ur
  JOIN public.institutions i ON i.id = ur.institution_id
  WHERE ur.user_id = _user_id AND ur.institution_id IS NOT NULL
  ORDER BY ur.is_active DESC, i.name ASC
$$;
