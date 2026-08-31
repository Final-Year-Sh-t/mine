CREATE POLICY "Institution admins can delete their logs"
ON public.verification_logs FOR DELETE
USING ((institution_id = get_user_institution(auth.uid())) AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Super admins can delete all logs"
ON public.verification_logs FOR DELETE
USING (is_super_admin(auth.uid()));

CREATE POLICY "Users can delete their own logs"
ON public.verification_logs FOR DELETE
USING (auth.uid() = verified_by);