-- Fix increment_trial_booking_used: single RETURN path (avoid duplicate RETURN QUERY rows in some cases).
CREATE OR REPLACE FUNCTION increment_trial_booking_used(p_barber_id UUID)
RETURNS TABLE(status TEXT, trial_booking_used INTEGER, trial_booking_limit INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_used INTEGER;
  v_limit INTEGER;
BEGIN
  UPDATE barber_subscription_state
  SET trial_booking_used = trial_booking_used + 1
  WHERE barber_id = p_barber_id
    AND status = 'trial'
  RETURNING trial_booking_used, trial_booking_limit
  INTO v_used, v_limit;

  IF FOUND AND v_used IS NOT NULL AND v_used >= v_limit THEN
    UPDATE barber_subscription_state
    SET status = 'inactive',
        updated_at = NOW()
    WHERE barber_id = p_barber_id
      AND status = 'trial';
  END IF;

  RETURN QUERY
  SELECT s.status::text, s.trial_booking_used, s.trial_booking_limit
  FROM barber_subscription_state s
  WHERE s.barber_id = p_barber_id;
END;
$$;

GRANT EXECUTE ON FUNCTION increment_trial_booking_used(UUID) TO authenticated;
