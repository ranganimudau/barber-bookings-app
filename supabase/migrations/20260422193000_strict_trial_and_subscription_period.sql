-- Strict trial/subscription enforcement
-- - Track monthly subscription window
-- - Count accepted bookings at DB level
-- - Auto-lock trial when limit reached

ALTER TABLE barber_subscription_state
  ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ;

-- Backfill any already-active rows that do not yet have a period.
UPDATE barber_subscription_state
SET
  subscription_started_at = COALESCE(subscription_started_at, activated_at, NOW()),
  subscription_ends_at = COALESCE(subscription_ends_at, COALESCE(activated_at, NOW()) + INTERVAL '30 days')
WHERE status = 'active';

CREATE OR REPLACE FUNCTION on_appointment_accept_increment_trial()
RETURNS TRIGGER AS $$
DECLARE
  accepted_new BOOLEAN;
  accepted_old BOOLEAN;
BEGIN
  accepted_new := LOWER(COALESCE(NEW.status, '')) IN ('confirmed', 'accepted', 'approved');
  accepted_old := LOWER(COALESCE(OLD.status, '')) IN ('confirmed', 'accepted', 'approved');

  -- Count only transition into accepted states.
  IF accepted_new AND NOT accepted_old AND NEW.barber_id IS NOT NULL THEN
    PERFORM increment_trial_booking_used(NEW.barber_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_appointment_accept_increment_trial ON appointments;
CREATE TRIGGER trg_appointment_accept_increment_trial
AFTER UPDATE OF status ON appointments
FOR EACH ROW
EXECUTE FUNCTION on_appointment_accept_increment_trial();
