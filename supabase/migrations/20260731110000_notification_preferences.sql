-- Notification toggles for the Settings screen.
--
-- These are read server-side by the send-appointment-push and
-- send-appointment-reminders edge functions before a push is sent — the
-- notifications originate on the server, so a client-only switch could not
-- actually stop them and would be a toggle that lies.
--
-- Default true so existing users keep the behaviour they have today.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notify_booking_confirmed BOOLEAN NOT NULL DEFAULT true,
  -- Covers declined, cancelled and no-show — all "this booking isn't
  -- happening" news, surfaced as one switch rather than three.
  ADD COLUMN IF NOT EXISTS notify_booking_declined BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_reminders BOOLEAN NOT NULL DEFAULT true;
