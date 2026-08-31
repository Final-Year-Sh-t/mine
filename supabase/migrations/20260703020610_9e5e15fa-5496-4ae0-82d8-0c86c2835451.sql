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