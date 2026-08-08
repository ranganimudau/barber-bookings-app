-- A booking the business never answered used to sit as 'pending' forever.
-- Once its date passed there was no way to accept or decline it, it stayed
-- in the barber's "New Booking Requests" list indefinitely, and — worst of
-- all — the client's app derived "pending + in the past" as **Completed**,
-- telling them a visit happened that never did.
--
-- 'expired' makes that state explicit: nobody responded, it's over, and the
-- client is told so they can book elsewhere.

CREATE OR REPLACE FUNCTION public.expire_stale_pending_appointments()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  -- appointment_date is a date and appointment_time a naive time, so they
  -- describe local wall-clock. Compare against now() converted to the same
  -- wall clock rather than UTC, or everything would expire two hours early.
  UPDATE public.appointments
  SET status = 'expired'
  WHERE LOWER(COALESCE(status, '')) IN ('pending', 'requested')
    AND (appointment_date + appointment_time) < (now() AT TIME ZONE 'Africa/Johannesburg');

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

-- One-time backfill of everything already stale. The appointments UPDATE
-- webhook is disabled around it so months-old test bookings don't each fire
-- an "expired" push at whoever created them.
ALTER TABLE public.appointments DISABLE TRIGGER notify_booking_update;
SELECT public.expire_stale_pending_appointments();
ALTER TABLE public.appointments ENABLE TRIGGER notify_booking_update;

-- Hourly from then on. Offset off the hour to stay clear of the other jobs.
SELECT cron.schedule(
  'expire-stale-pending-appointments',
  '15 * * * *',
  $$ SELECT public.expire_stale_pending_appointments(); $$
);
