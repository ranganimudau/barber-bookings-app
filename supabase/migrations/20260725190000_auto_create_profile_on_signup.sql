-- Create the profiles row automatically when an auth user is created,
-- instead of relying on the app to insert it right after signUp().
--
-- The client-side insert had a permanent-lockout failure mode: if the auth
-- user was created but the profiles insert failed (network drop, RLS hiccup,
-- app killed mid-flow), the account existed with no profile. Login does
-- .single() on profiles and throws "Could not find profile", so that user
-- could never sign in — and could never re-register either, because the
-- email was already taken. Doing it in the same transaction as the auth
-- insert makes that state unreachable.
--
-- Reads full_name/role out of the signup metadata the app passes in
-- options.data, falling back to 'client' so a profile always has a valid
-- role even if metadata is missing.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'full_name', '')), ''),
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'role', ''), 'client')
  )
  -- Signup also inserts client-side today; whichever lands first wins and
  -- the other is a no-op rather than an error.
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Backfill any account that already lost this race (none at time of
-- writing, but makes the migration safe to run on any environment).
INSERT INTO public.profiles (id, email, full_name, role)
SELECT
  u.id,
  u.email,
  NULLIF(TRIM(COALESCE(u.raw_user_meta_data ->> 'full_name', '')), ''),
  COALESCE(NULLIF(u.raw_user_meta_data ->> 'role', ''), 'client')
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;
