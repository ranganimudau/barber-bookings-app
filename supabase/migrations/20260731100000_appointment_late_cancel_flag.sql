-- Client-side feedback: cancelling inside the 48h reschedule/cancel window
-- currently isn't allowed at all, which leaves the business holding a dead
-- slot when a client knows they can't make it. We're relaxing cancellation
-- to always be allowed, but flagging late ones so the business can see the
-- pattern instead of the slot just silently disappearing.
--
-- 'declined' (business rejected a request) and 'no_show' (business marks a
-- client didn't show) are introduced as real appointments.status values
-- alongside the existing pending/confirmed/completed/cancelled — no schema
-- change needed for those since status is free text already.

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS is_late_cancel BOOLEAN NOT NULL DEFAULT false;
