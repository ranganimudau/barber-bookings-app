-- Replace booking-count trial model with time-based PayFast model:
-- R50 once-off -> 20 day unlimited-booking trial -> R70/month recurring.
-- shop_status ('active' | 'locked') becomes the single gating source of truth.

-- 1. Drop the obsolete booking-count trial trigger/function (superseded by
--    time-based trial + subscription-sweep cron job).
DROP TRIGGER IF EXISTS trg_appointment_accept_increment_trial ON appointments;
DROP FUNCTION IF EXISTS on_appointment_accept_increment_trial();
DROP FUNCTION IF EXISTS increment_trial_booking_used(UUID);

-- 2. Rebuild barber_subscription_state around shop_status / trial window /
--    subscription window. Existing rows are disposable test data.
ALTER TABLE barber_subscription_state
  DROP COLUMN IF EXISTS trial_booking_limit,
  DROP COLUMN IF EXISTS trial_booking_used,
  DROP COLUMN IF EXISTS trial_started_at,
  DROP COLUMN IF EXISTS activated_at,
  DROP COLUMN IF EXISTS payment_plan,
  DROP COLUMN IF EXISTS registration_fee_paid,
  DROP COLUMN IF EXISTS registration_fee_amount,
  DROP COLUMN IF EXISTS subscription_fee_amount,
  DROP COLUMN IF EXISTS subscription_started_at,
  DROP COLUMN IF EXISTS subscription_ends_at,
  DROP COLUMN IF EXISTS status;

ALTER TABLE barber_subscription_state
  ADD COLUMN IF NOT EXISTS shop_status TEXT NOT NULL DEFAULT 'locked'
    CHECK (shop_status IN ('active', 'locked')),
  ADD COLUMN IF NOT EXISTS trial_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'none'
    CHECK (subscription_status IN ('none', 'active', 'grace', 'cancelled')),
  ADD COLUMN IF NOT EXISTS subscription_renews_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS grace_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payfast_token TEXT;

CREATE INDEX IF NOT EXISTS idx_barber_subscription_state_shop_status
  ON barber_subscription_state (shop_status);
CREATE INDEX IF NOT EXISTS idx_barber_subscription_state_trial_end
  ON barber_subscription_state (trial_end);
CREATE INDEX IF NOT EXISTS idx_barber_subscription_state_grace
  ON barber_subscription_state (grace_started_at);

-- 3. Relax the payments plan enum to the new two-plan model. Drop the old
--    constraint first so old plan labels (disposable test data) can be
--    normalized into the new two buckets, then attach the new CHECK.
ALTER TABLE barber_subscription_payments DROP CONSTRAINT IF EXISTS barber_subscription_payments_plan_check;

UPDATE barber_subscription_payments SET plan = 'trial' WHERE plan = 'trial_then_sub';
UPDATE barber_subscription_payments SET plan = 'subscription' WHERE plan IN ('subscribe_now', 'subscription_only');

ALTER TABLE barber_subscription_payments ADD CONSTRAINT barber_subscription_payments_plan_check
  CHECK (plan IN ('trial', 'subscription'));

-- 4. Denormalize shop_status onto barbers so client map/search queries can
--    filter with a plain .eq() instead of a join.
ALTER TABLE barbers ADD COLUMN IF NOT EXISTS shop_status TEXT NOT NULL DEFAULT 'locked'
  CHECK (shop_status IN ('active', 'locked'));

CREATE OR REPLACE FUNCTION sync_barber_shop_status()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE barbers SET shop_status = NEW.shop_status WHERE id = NEW.barber_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_barber_shop_status ON barber_subscription_state;
CREATE TRIGGER trg_sync_barber_shop_status
AFTER INSERT OR UPDATE OF shop_status ON barber_subscription_state
FOR EACH ROW
EXECUTE FUNCTION sync_barber_shop_status();

-- Backfill barbers.shop_status from any existing subscription rows.
UPDATE barbers b
SET shop_status = s.shop_status
FROM barber_subscription_state s
WHERE s.barber_id = b.id;

-- 5. Server-side enforcement: a day can't be blocked/marked unavailable if
--    it already has confirmed bookings (spec section 5). Client already
--    checks this for instant feedback; this makes it authoritative.
CREATE OR REPLACE FUNCTION prevent_blocking_day_with_confirmed_bookings()
RETURNS TRIGGER AS $$
DECLARE
  confirmed_count INTEGER;
BEGIN
  IF NEW.is_available = FALSE THEN
    SELECT COUNT(*) INTO confirmed_count
    FROM appointments
    WHERE barber_id = NEW.barber_id
      AND appointment_date = NEW.available_date
      AND LOWER(COALESCE(status, '')) IN ('confirmed', 'accepted', 'approved');

    IF confirmed_count > 0 THEN
      RAISE EXCEPTION 'Cannot mark % unavailable: % confirmed booking(s) exist', NEW.available_date, confirmed_count
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_blocking_day_with_confirmed_bookings ON barber_availability;
CREATE TRIGGER trg_prevent_blocking_day_with_confirmed_bookings
BEFORE INSERT OR UPDATE OF is_available ON barber_availability
FOR EACH ROW
EXECUTE FUNCTION prevent_blocking_day_with_confirmed_bookings();
