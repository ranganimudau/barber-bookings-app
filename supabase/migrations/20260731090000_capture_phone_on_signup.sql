-- Signup now collects a phone number (not yet OTP-verified — that needs a
-- paid SMS provider wired into Supabase, deferred for now). Extends the
-- handle_new_user trigger from 20260725190000 to also read it out of
-- signup metadata, same pattern as full_name/role.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, phone_number)
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'full_name', '')), ''),
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'role', ''), 'client'),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'phone_number', '')), '')
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;
