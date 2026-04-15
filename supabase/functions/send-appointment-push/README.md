# send-appointment-push

Supabase Edge Function that sends Expo push notifications to barbers for:

- New booking requests (`INSERT` on `appointments`)
- Status changes (`UPDATE` on `appointments`) for confirm/cancel

## Required setup

1. Deploy function:
   - `supabase functions deploy send-appointment-push`

2. Run migrations (includes `user_push_tokens` table):
   - `supabase db push`

3. Create **two Database Webhooks** in Supabase Dashboard:
   - Table: `public.appointments`
   - Event: `Insert`
   - Edge Function: `send-appointment-push`
   - Table: `public.appointments`
   - Event: `Update`
   - Edge Function: `send-appointment-push`

4. Ensure app clients are registering Expo push tokens into `public.user_push_tokens`.

## Notes

- This function sends notifications through Expo endpoint:
  `https://exp.host/--/api/v2/push/send`
- It uses `SUPABASE_SERVICE_ROLE_KEY` automatically provided in Supabase Functions environment.
