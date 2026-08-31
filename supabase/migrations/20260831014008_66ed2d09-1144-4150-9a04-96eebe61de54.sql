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