-- Self-serve subscription cancellation: barber can cancel anytime but keeps
-- full access until the period they already paid for ends. No refunds, no
-- early lockout. cancel_at_period_end tracks "will not auto-renew" without
-- touching shop_status/subscription_status until the actual renewal date —
-- see supabase/functions/cancel-payfast-subscription and the sweep step in
-- supabase/functions/subscription-sweep.

ALTER TABLE barber_subscription_state
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false;
