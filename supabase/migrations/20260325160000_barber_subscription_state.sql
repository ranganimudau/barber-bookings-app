-- Barber subscription / trial state (SaaS gating & first-5 bookings trial)
-- Run: supabase migration run <timestamp>

CREATE TABLE IF NOT EXISTS barber_subscription_state (
  barber_id UUID PRIMARY KEY REFERENCES barbers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'inactive', -- 'inactive' | 'trial' | 'active'
  trial_booking_limit INTEGER NOT NULL DEFAULT 5,
  trial_booking_used INTEGER NOT NULL DEFAULT 0,
  trial_started_at TIMESTAMPTZ DEFAULT NOW(),
  activated_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_barber_subscription_state_status
  ON barber_subscription_state(status);

ALTER TABLE barber_subscription_state ENABLE ROW LEVEL SECURITY;

-- Barber can read their own subscription state
CREATE POLICY "Barber can read own subscription state"
  ON barber_subscription_state FOR SELECT
  USING (auth.uid() = barber_id);

-- Barber can update their own subscription state
-- NOTE: For production, tighten this so only server verifies payments.
CREATE POLICY "Barber can update own subscription state"
  ON barber_subscription_state FOR INSERT
  WITH CHECK (auth.uid() = barber_id);

CREATE POLICY "Barber can update own subscription state (update)"
  ON barber_subscription_state FOR UPDATE
  USING (auth.uid() = barber_id)
  WITH CHECK (auth.uid() = barber_id);

-- Keep updated_at fresh
CREATE OR REPLACE FUNCTION set_barber_subscription_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_barber_subscription_updated_at ON barber_subscription_state;
CREATE TRIGGER trg_barber_subscription_updated_at
BEFORE UPDATE ON barber_subscription_state
FOR EACH ROW
EXECUTE FUNCTION set_barber_subscription_updated_at();

-- Atomic: increment trial booking used; lock after limit
CREATE OR REPLACE FUNCTION increment_trial_booking_used(p_barber_id UUID)
RETURNS TABLE(status TEXT, trial_booking_used INTEGER, trial_booking_limit INTEGER) AS $$
DECLARE
  v_used INTEGER;
  v_limit INTEGER;
  v_status TEXT;
BEGIN
  UPDATE barber_subscription_state
  SET trial_booking_used = trial_booking_used + 1
  WHERE barber_id = p_barber_id
    AND status = 'trial'
  RETURNING trial_booking_used, trial_booking_limit, status
  INTO v_used, v_limit, v_status;

  IF v_used IS NULL THEN
    RETURN QUERY
    SELECT status, trial_booking_used, trial_booking_limit
    FROM barber_subscription_state
    WHERE barber_id = p_barber_id;
  END IF;

  -- If limit reached/exceeded, switch to inactive
  IF v_used >= v_limit THEN
    UPDATE barber_subscription_state
    SET status = 'inactive',
        updated_at = NOW()
    WHERE barber_id = p_barber_id
      AND status = 'trial';
  END IF;

  RETURN QUERY
  SELECT status, trial_booking_used, trial_booking_limit
  FROM barber_subscription_state
  WHERE barber_id = p_barber_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Allow app to call the RPC
GRANT EXECUTE ON FUNCTION increment_trial_booking_used(UUID) TO authenticated;

