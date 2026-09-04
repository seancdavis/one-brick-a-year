CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_ms integer,
  years_reached double precision NOT NULL DEFAULT 0,
  finished boolean NOT NULL DEFAULT false,
  age_years smallint,
  home_meters real,
  color_id text,
  sound_on boolean,
  input_kind text,
  viewport_w smallint,
  viewport_h smallint,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_started_at_idx ON sessions (started_at);
