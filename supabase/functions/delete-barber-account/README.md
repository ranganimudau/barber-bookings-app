# delete-barber-account

Permanently removes a **barber** account (JWT required, `profiles.role = barber`):

- `bookings`, `appointments` (and related ratings/reminders where FKs apply)
- `barber_availability`, `barber_services`, `barber_subscription_state`, `barbers`, `profiles`
- The **`auth.users`** record

## Deploy

From the project root (with Supabase CLI logged in and project linked):

```bash
npx supabase functions deploy delete-barber-account --no-verify-jwt
```

**Why `--no-verify-jwt`?** Supabase’s API gateway often returns `401 Invalid JWT` for valid mobile `access_token` values. JWT validation is disabled at the edge so requests reach our code, which still requires `Authorization: Bearer …` and runs `auth.getUser()` with the anon key.

`supabase/config.toml` sets `verify_jwt = false` for this function so future deploys stay consistent (some CLI versions need the flag anyway—use both).

If you use the dashboard: **Edge Functions → create/deploy** from this folder.

## Secrets

Uses built-in `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the Edge runtime.
