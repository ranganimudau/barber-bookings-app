-- Client ratings for barbers (one rating per appointment).
-- Run this in Supabase Dashboard > SQL Editor.

CREATE TABLE IF NOT EXISTS barber_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  barber_id UUID NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(appointment_id)
);

CREATE INDEX IF NOT EXISTS idx_barber_ratings_barber_id ON barber_ratings(barber_id);
CREATE INDEX IF NOT EXISTS idx_barber_ratings_client_id ON barber_ratings(client_id);

ALTER TABLE barber_ratings ENABLE ROW LEVEL SECURITY;

-- Clients can insert a rating for their own appointment.
CREATE POLICY "Clients can insert own rating"
  ON barber_ratings FOR INSERT
  WITH CHECK (
    auth.uid() = client_id
    AND EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.id = appointment_id AND a.client_id = auth.uid()
    )
  );

-- Anyone can read ratings (to show barber averages).
CREATE POLICY "Anyone can read ratings"
  ON barber_ratings FOR SELECT
  USING (true);

-- Clients can update/delete only their own rating (optional).
CREATE POLICY "Clients can update own rating"
  ON barber_ratings FOR UPDATE
  USING (auth.uid() = client_id)
  WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Clients can delete own rating"
  ON barber_ratings FOR DELETE
  USING (auth.uid() = client_id);
