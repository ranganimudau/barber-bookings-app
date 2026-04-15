-- PayFast-backed registration/subscription flow
-- - trial_then_sub: pay R70 registration, unlock 5 free accepted bookings, then pay R100
-- - subscribe_now: pay R30 registration + R100 subscription immediately (no free 5)

ALTER TABLE IF EXISTS barber_subscription_state
  ADD COLUMN IF NOT EXISTS registration_fee_paid BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS registration_fee_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subscription_fee_amount NUMERIC(10,2) NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS payment_plan TEXT;

CREATE TABLE IF NOT EXISTS barber_subscription_payments (
  payment_ref TEXT PRIMARY KEY,
  barber_id UUID NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK (plan IN ('trial_then_sub', 'subscribe_now', 'subscription_only')),
  amount NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'complete', 'failed', 'cancelled')),
  payfast_payment_id TEXT,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_barber_subscription_payments_barber_id
  ON barber_subscription_payments (barber_id);

CREATE INDEX IF NOT EXISTS idx_barber_subscription_payments_status
  ON barber_subscription_payments (status);

ALTER TABLE barber_subscription_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Barber can read own subscription payments"
  ON barber_subscription_payments FOR SELECT
  USING (auth.uid() = barber_id);

CREATE POLICY "Barber can create own subscription payments"
  ON barber_subscription_payments FOR INSERT
  WITH CHECK (auth.uid() = barber_id);
