-- Create enum for verification status
CREATE TYPE public.verification_status AS ENUM ('pending', 'verified', 'rejected', 'expired');

-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Create index_records table for storing verified identities
CREATE TABLE public.index_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  index_number TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  photo_url TEXT,
  organization TEXT NOT NULL,
  issued_at DATE NOT NULL,
  expires_at DATE NOT NULL,
  status verification_status NOT NULL DEFAULT 'pending',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create verification_logs table for audit trail
CREATE TABLE public.verification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  index_number TEXT NOT NULL,
  verified_by UUID REFERENCES auth.users(id),
  verification_result BOOLEAN NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.index_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_logs ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- User roles policies (only admins can manage roles)
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Index records policies
CREATE POLICY "Authenticated users can view verified records"
  ON public.index_records FOR SELECT
  TO authenticated
  USING (status = 'verified');

CREATE POLICY "Admins can view all records"
  ON public.index_records FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert records"
  ON public.index_records FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update records"
  ON public.index_records FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete records"
  ON public.index_records FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Verification logs policies
CREATE POLICY "Users can view their own verification logs"
  ON public.verification_logs FOR SELECT
  USING (auth.uid() = verified_by);

CREATE POLICY "Authenticated users can insert verification logs"
  ON public.verification_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = verified_by);

CREATE POLICY "Admins can view all verification logs"
  ON public.verification_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name');
  
  -- Assign default user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;

-- Trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_index_records_updated_at
  BEFORE UPDATE ON public.index_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
-- First migration: Add super_admin to enum (must be committed separately)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
-- Create institutions table
CREATE TABLE public.institutions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#3B82F6',
  secondary_color TEXT DEFAULT '#1E40AF',
  welcome_text TEXT DEFAULT 'Welcome to our verification portal',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on institutions
ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;

-- Add institution_id to index_records
ALTER TABLE public.index_records ADD COLUMN institution_id UUID REFERENCES public.institutions(id) ON DELETE CASCADE;

-- Add institution_id to user_roles
ALTER TABLE public.user_roles ADD COLUMN institution_id UUID REFERENCES public.institutions(id) ON DELETE CASCADE;

-- Add institution_id to verification_logs
ALTER TABLE public.verification_logs ADD COLUMN institution_id UUID REFERENCES public.institutions(id) ON DELETE CASCADE;

-- Add institution_id to profiles
ALTER TABLE public.profiles ADD COLUMN institution_id UUID REFERENCES public.institutions(id) ON DELETE SET NULL;

-- Create function to check super_admin role
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'super_admin'
  )
$$;

-- Create function to get user's institution_id
CREATE OR REPLACE FUNCTION public.get_user_institution(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT institution_id
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- RLS policies for institutions
CREATE POLICY "Super admins can manage all institutions"
ON public.institutions
FOR ALL
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Institution admins can view their institution"
ON public.institutions
FOR SELECT
USING (
  id IN (
    SELECT institution_id FROM public.user_roles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Public can view institutions for login"
ON public.institutions
FOR SELECT
USING (true);

-- Update index_records policies to scope by institution
DROP POLICY IF EXISTS "Admins can delete records" ON public.index_records;
DROP POLICY IF EXISTS "Admins can insert records" ON public.index_records;
DROP POLICY IF EXISTS "Admins can update records" ON public.index_records;
DROP POLICY IF EXISTS "Admins can view all records" ON public.index_records;
DROP POLICY IF EXISTS "Authenticated users can view verified records" ON public.index_records;

CREATE POLICY "Super admins can manage all records"
ON public.index_records
FOR ALL
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Institution admins can manage their records"
ON public.index_records
FOR ALL
USING (
  institution_id = public.get_user_institution(auth.uid())
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Authenticated users can view verified records in their institution"
ON public.index_records
FOR SELECT
USING (
  status = 'verified'
  AND institution_id = public.get_user_institution(auth.uid())
);

-- Update verification_logs policies
DROP POLICY IF EXISTS "Admins can view all verification logs" ON public.verification_logs;
DROP POLICY IF EXISTS "Authenticated users can insert verification logs" ON public.verification_logs;
DROP POLICY IF EXISTS "Users can view their own verification logs" ON public.verification_logs;

CREATE POLICY "Super admins can view all logs"
ON public.verification_logs
FOR SELECT
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Institution admins can view their logs"
ON public.verification_logs
FOR SELECT
USING (
  institution_id = public.get_user_institution(auth.uid())
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Users can insert verification logs"
ON public.verification_logs
FOR INSERT
WITH CHECK (auth.uid() = verified_by);

CREATE POLICY "Users can view their own logs"
ON public.verification_logs
FOR SELECT
USING (auth.uid() = verified_by);

-- Update user_roles policies
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

CREATE POLICY "Super admins can manage all roles"
ON public.user_roles
FOR ALL
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Institution admins can view roles in their institution"
ON public.user_roles
FOR SELECT
USING (
  institution_id = public.get_user_institution(auth.uid())
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- Trigger for institutions updated_at
CREATE TRIGGER update_institutions_updated_at
BEFORE UPDATE ON public.institutions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
-- Create storage bucket for institution logos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('institution-logos', 'institution-logos', true);

-- Storage policies for institution logos
CREATE POLICY "Anyone can view institution logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'institution-logos');

CREATE POLICY "Institution admins can upload logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'institution-logos' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Institution admins can update logos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'institution-logos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Institution admins can delete logos"
ON storage.objects FOR DELETE
USING (bucket_id = 'institution-logos' AND auth.uid() IS NOT NULL);

-- Add verification settings to institutions
ALTER TABLE public.institutions 
ADD COLUMN IF NOT EXISTS require_photo BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS enforce_expiry BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS allow_public_verification BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '[]'::jsonb;

-- Create staff_roles enum for different staff types
CREATE TYPE public.staff_role AS ENUM ('verifier', 'registrar', 'security', 'viewer');

-- Add staff_type to user_roles for more granular control
ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS staff_type staff_role;
-- Allow institution admins to update roles for users in their institution (promote to admin)
CREATE POLICY "Institution admins can update roles in their institution"
ON public.user_roles
FOR UPDATE
USING (
  (institution_id = get_user_institution(auth.uid())) 
  AND has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  (institution_id = get_user_institution(auth.uid())) 
  AND has_role(auth.uid(), 'admin'::app_role)
);
-- Allow authenticated users to create institutions
CREATE POLICY "Authenticated users can create institutions"
ON public.institutions
FOR INSERT
TO authenticated
WITH CHECK (true);
-- Create institution for current authenticated user and assign them as admin
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

  -- Upsert-ish into user_roles (table may or may not already have a row)
  UPDATE public.user_roles
  SET institution_id = new_institution_id,
      role = 'admin'::app_role
  WHERE user_id = auth.uid();

  IF NOT FOUND THEN
    INSERT INTO public.user_roles (user_id, role, institution_id)
    VALUES (auth.uid(), 'admin'::app_role, new_institution_id);
  END IF;

  -- Link profile to institution if profile exists
  UPDATE public.profiles
  SET institution_id = new_institution_id
  WHERE user_id = auth.uid();

  RETURN new_institution_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_institution_for_current_user(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_institution_for_current_user(text) TO authenticated;


-- Join an institution for current authenticated user (does not escalate role)
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

  -- Ensure institution exists
  PERFORM 1 FROM public.institutions WHERE id = _institution_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Institution not found';
  END IF;

  UPDATE public.user_roles
  SET institution_id = _institution_id
  WHERE user_id = auth.uid();

  IF NOT FOUND THEN
    INSERT INTO public.user_roles (user_id, role, institution_id)
    VALUES (auth.uid(), 'user'::app_role, _institution_id);
  END IF;

  UPDATE public.profiles
  SET institution_id = _institution_id
  WHERE user_id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.join_institution_for_current_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_institution_for_current_user(uuid) TO authenticated;
-- Add is_active column
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT false;

-- Set is_active for rows that have institution_id, only one per user should be active
-- For rows without institution_id (like super_admin), set is_active = false
UPDATE public.user_roles 
SET is_active = CASE 
  WHEN institution_id IS NOT NULL THEN true 
  ELSE false 
END;

-- Make is_active NOT NULL
ALTER TABLE public.user_roles ALTER COLUMN is_active SET NOT NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_roles_user_active ON public.user_roles(user_id, is_active);

-- Create unique constraint: only one active institution per user (only for rows with is_active = true)
CREATE UNIQUE INDEX idx_user_roles_one_active ON public.user_roles(user_id) WHERE is_active = true;

-- Create unique constraint: user can only have one role per institution (if institution is not null)
CREATE UNIQUE INDEX idx_user_roles_user_institution_unique ON public.user_roles(user_id, institution_id) WHERE institution_id IS NOT NULL;

-- Update get_user_institution to return the ACTIVE institution
CREATE OR REPLACE FUNCTION public.get_user_institution(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT institution_id
  FROM public.user_roles
  WHERE user_id = _user_id AND is_active = true
  LIMIT 1
$$;

-- Create function to get all user institutions
CREATE OR REPLACE FUNCTION public.get_user_institutions(_user_id uuid)
RETURNS TABLE (
  institution_id uuid,
  institution_name text,
  institution_slug text,
  role app_role,
  is_active boolean
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
    ur.is_active
  FROM public.user_roles ur
  JOIN public.institutions i ON i.id = ur.institution_id
  WHERE ur.user_id = _user_id AND ur.institution_id IS NOT NULL
  ORDER BY ur.is_active DESC, i.name ASC
$$;

-- Create function to switch active institution
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

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND institution_id = _institution_id
  ) THEN
    RAISE EXCEPTION 'Not a member of this institution';
  END IF;

  UPDATE public.user_roles
  SET is_active = false
  WHERE user_id = auth.uid();

  UPDATE public.user_roles
  SET is_active = true
  WHERE user_id = auth.uid() AND institution_id = _institution_id;

  UPDATE public.profiles
  SET institution_id = _institution_id
  WHERE user_id = auth.uid();
END;
$$;

-- Update create_institution_for_current_user to support multi-membership
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

  INSERT INTO public.user_roles (user_id, role, institution_id, is_active)
  VALUES (auth.uid(), 'admin'::app_role, new_institution_id, true);

  UPDATE public.profiles
  SET institution_id = new_institution_id
  WHERE user_id = auth.uid();

  RETURN new_institution_id;
END;
$$;

-- Update join_institution_for_current_user to support multi-membership
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
    PERFORM public.switch_active_institution(_institution_id);
    RETURN;
  END IF;

  UPDATE public.user_roles
  SET is_active = false
  WHERE user_id = auth.uid();

  INSERT INTO public.user_roles (user_id, role, institution_id, is_active)
  VALUES (auth.uid(), 'user'::app_role, _institution_id, true);

  UPDATE public.profiles
  SET institution_id = _institution_id
  WHERE user_id = auth.uid();
END;
$$;
-- Drop the old constraint that prevents multi-institution membership
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;

-- 1. user_roles: add restrictive INSERT policy (only super_admins can insert)
CREATE POLICY "Only super admins can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin(auth.uid()));

-- 2. institutions: replace permissive INSERT policy
DROP POLICY IF EXISTS "Authenticated users can create institutions" ON public.institutions;
CREATE POLICY "Only super admins can create institutions"
ON public.institutions
FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin(auth.uid()));

-- 3. institutions: remove broad public read
DROP POLICY IF EXISTS "Public can view institutions for login" ON public.institutions;
CREATE POLICY "Authenticated users can view institutions"
ON public.institutions
FOR SELECT
TO authenticated
USING (true);

-- 4. Storage: tighten institution-logos modify policies (path = {institution_id}/...)
DROP POLICY IF EXISTS "Institution admins can upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Institution admins can update logos" ON storage.objects;
DROP POLICY IF EXISTS "Institution admins can delete logos" ON storage.objects;

CREATE POLICY "Institution admins can upload logos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'institution-logos'
  AND (
    public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'::app_role
        AND ur.institution_id::text = (storage.foldername(name))[1]
    )
  )
);

CREATE POLICY "Institution admins can update logos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'institution-logos'
  AND (
    public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'::app_role
        AND ur.institution_id::text = (storage.foldername(name))[1]
    )
  )
);

CREATE POLICY "Institution admins can delete logos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'institution-logos'
  AND (
    public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'::app_role
        AND ur.institution_id::text = (storage.foldername(name))[1]
    )
  )
);

-- 5. Revoke EXECUTE from anon on sensitive SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.create_institution_for_current_user(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.join_institution_for_current_user(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.switch_active_institution(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_user_institution(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_user_institutions(uuid) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.create_institution_for_current_user(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_institution_for_current_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.switch_active_institution(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_institution(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_institutions(uuid) TO authenticated;
UPDATE public.index_records SET status = 'verified' WHERE status = 'pending';
ALTER TABLE public.index_records ALTER COLUMN status SET DEFAULT 'verified'::verification_status;
-- 1. Drop the policy that depends on the status column
DROP POLICY IF EXISTS "Authenticated users can view verified records in their institut" ON public.index_records;

-- 2. Drop the default that depends on the enum
ALTER TABLE public.index_records ALTER COLUMN status DROP DEFAULT;

-- 3. Change column to text so we can update values freely
ALTER TABLE public.index_records ALTER COLUMN status TYPE text USING status::text;

-- 4. Migrate existing data
UPDATE public.index_records SET status = 'active' WHERE status IN ('verified', 'pending');
UPDATE public.index_records SET status = 'inactive' WHERE status = 'rejected';

-- 5. Drop the old enum type
DROP TYPE IF EXISTS public.verification_status;

-- 6. Create the new enum with desired values
CREATE TYPE public.verification_status AS ENUM ('active', 'inactive', 'expired');

-- 7. Change column type to new enum
ALTER TABLE public.index_records ALTER COLUMN status TYPE public.verification_status USING status::public.verification_status;

-- 8. Set new default
ALTER TABLE public.index_records ALTER COLUMN status SET DEFAULT 'active'::public.verification_status;

-- 9. Recreate the policy with updated condition
CREATE POLICY "Authenticated users can view active records in their institut" 
ON public.index_records 
FOR SELECT 
TO public
USING ((status = 'active'::public.verification_status) AND (institution_id = get_user_institution(auth.uid())));
CREATE POLICY "Institution admins can update their institution"
ON public.institutions
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND institution_id = institutions.id
      AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND institution_id = institutions.id
      AND role = 'admin'
  )
);
CREATE POLICY "Institution admins can delete their logs"
ON public.verification_logs FOR DELETE
USING ((institution_id = get_user_institution(auth.uid())) AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Super admins can delete all logs"
ON public.verification_logs FOR DELETE
USING (is_super_admin(auth.uid()));

CREATE POLICY "Users can delete their own logs"
ON public.verification_logs FOR DELETE
USING (auth.uid() = verified_by);
CREATE POLICY "Anyone can view identity photos"
ON storage.objects FOR SELECT
TO public
USING (
  bucket_id = 'identity-photos'::text
  AND (
    is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.institution_id IS NOT NULL
        AND (ur.institution_id)::text = (storage.foldername(objects.name))[1]
    )
  )
);

CREATE POLICY "Institution admins can upload identity photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'identity-photos'::text
  AND (
    is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'::app_role
        AND ur.institution_id IS NOT NULL
        AND (ur.institution_id)::text = (storage.foldername(objects.name))[1]
    )
  )
);

CREATE POLICY "Institution admins can update identity photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'identity-photos'::text
  AND (
    is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'::app_role
        AND ur.institution_id IS NOT NULL
        AND (ur.institution_id)::text = (storage.foldername(objects.name))[1]
    )
  )
)
WITH CHECK (
  bucket_id = 'identity-photos'::text
  AND (
    is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'::app_role
        AND ur.institution_id IS NOT NULL
        AND (ur.institution_id)::text = (storage.foldername(objects.name))[1]
    )
  )
);

CREATE POLICY "Institution admins can delete identity photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'identity-photos'::text
  AND (
    is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'::app_role
        AND ur.institution_id IS NOT NULL
        AND (ur.institution_id)::text = (storage.foldername(objects.name))[1]
    )
  )
);

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

