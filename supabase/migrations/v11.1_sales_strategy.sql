-- v1.1 Sales Strategy Migration (#2a)
-- Apply via Supabase SQL Editor. First run is clean.
-- Re-run will fail on CREATE TYPE (already exists) - safe to ignore.

-- ENUMs
CREATE TYPE sales_activity_type AS ENUM (
  'call', 'meeting', 'email', 'sample_send', 'sample_return',
  'catalog_send', 'proposal_send', 'consultation', 'follow_up',
  'visit', 'event', 'other'
);

CREATE TYPE sales_stage_7 AS ENUM (
  'prospecting', 'rapport', 'needs', 'presentation',
  'objection', 'closing', 'follow_up'
);

CREATE TYPE objection_kind AS ENUM (
  'price', 'quality', 'lead_time', 'competitor', 'budget',
  'authority', 'urgency', 'fit', 'other'
);

CREATE TYPE need_card_status AS ENUM (
  'new', 'shared', 'in_progress', 'addressed', 'archived'
);

-- clients table extension
ALTER TABLE clients ADD COLUMN IF NOT EXISTS current_stage sales_stage_7 DEFAULT 'prospecting';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS assigned_agent_id UUID REFERENCES profiles(id);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS lifecycle_stage TEXT DEFAULT 'new';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_contact_date DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS dream100 BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_clients_stage ON clients(current_stage);
CREATE INDEX IF NOT EXISTS idx_clients_agent ON clients(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_clients_lifecycle ON clients(lifecycle_stage);
CREATE INDEX IF NOT EXISTS idx_clients_dream100 ON clients(dream100) WHERE dream100 = true;

-- sales_activities
CREATE TABLE IF NOT EXISTS sales_activities (
  id SERIAL PRIMARY KEY,
  agent_id UUID REFERENCES profiles(id),
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  activity_type sales_activity_type NOT NULL,
  activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
  activity_time TIME,
  duration_minutes INTEGER,
  outcome TEXT,
  value_generated NUMERIC(12,2),
  next_action TEXT,
  next_action_date DATE,
  stage_before sales_stage_7,
  stage_after sales_stage_7,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_activities_agent_date ON sales_activities(agent_id, activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_activities_client ON sales_activities(client_id, activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_activities_type ON sales_activities(activity_type);

-- stage_transitions
CREATE TABLE IF NOT EXISTS stage_transitions (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  from_stage sales_stage_7,
  to_stage sales_stage_7 NOT NULL,
  transition_date DATE NOT NULL DEFAULT CURRENT_DATE,
  days_in_previous_stage INTEGER,
  triggered_by_activity INTEGER REFERENCES sales_activities(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stage_transitions_client ON stage_transitions(client_id, transition_date DESC);

-- sales_objections
CREATE TABLE IF NOT EXISTS sales_objections (
  id SERIAL PRIMARY KEY,
  agent_id UUID REFERENCES profiles(id),
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  kind objection_kind NOT NULL,
  lost_stage sales_stage_7,
  description TEXT,
  resolution TEXT,
  resolved BOOLEAN DEFAULT false,
  learning_note TEXT,
  occurred_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_objections_kind ON sales_objections(kind);
CREATE INDEX IF NOT EXISTS idx_sales_objections_agent ON sales_objections(agent_id);

-- need_cards
CREATE TABLE IF NOT EXISTS need_cards (
  id SERIAL PRIMARY KEY,
  agent_id UUID REFERENCES profiles(id),
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  category TEXT,
  description TEXT NOT NULL,
  discovery_method TEXT,
  status need_card_status DEFAULT 'new',
  votes INTEGER DEFAULT 0,
  resolution_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_need_cards_status ON need_cards(status);
CREATE INDEX IF NOT EXISTS idx_need_cards_category ON need_cards(category);
CREATE INDEX IF NOT EXISTS idx_need_cards_client ON need_cards(client_id);

-- sales_kpi_snapshots
CREATE TABLE IF NOT EXISTS sales_kpi_snapshots (
  id SERIAL PRIMARY KEY,
  agent_id UUID REFERENCES profiles(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  period_type TEXT DEFAULT 'week',
  meetings INTEGER DEFAULT 0,
  calls INTEGER DEFAULT 0,
  samples_sent INTEGER DEFAULT 0,
  contacts INTEGER DEFAULT 0,
  proposals INTEGER DEFAULT 0,
  quotes_amount NUMERIC(12,2) DEFAULT 0,
  sales_amount NUMERIC(12,2) DEFAULT 0,
  new_clients INTEGER DEFAULT 0,
  retained_clients INTEGER DEFAULT 0,
  lost_clients INTEGER DEFAULT 0,
  total_hours NUMERIC(6,2) DEFAULT 0,
  time_charge NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(agent_id, period_start, period_end, period_type)
);

CREATE INDEX IF NOT EXISTS idx_kpi_agent_period ON sales_kpi_snapshots(agent_id, period_start DESC);

-- ai_sales_recommendations
CREATE TABLE IF NOT EXISTS ai_sales_recommendations (
  id SERIAL PRIMARY KEY,
  agent_id UUID REFERENCES profiles(id),
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  recommendation_type TEXT,
  recommendation TEXT NOT NULL,
  rationale TEXT,
  status TEXT DEFAULT 'pending',
  generated_at TIMESTAMPTZ DEFAULT now(),
  acted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ai_sales_rec_agent ON ai_sales_recommendations(agent_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_sales_rec_status ON ai_sales_recommendations(status);

-- segments table extension
ALTER TABLE segments ADD COLUMN IF NOT EXISTS sales_sequence TEXT[];
ALTER TABLE segments ADD COLUMN IF NOT EXISTS recommended_catalog TEXT;
ALTER TABLE segments ADD COLUMN IF NOT EXISTS typical_objections TEXT[];
ALTER TABLE segments ADD COLUMN IF NOT EXISTS conversion_tips TEXT;

-- trigger function: update client on activity insert
CREATE OR REPLACE FUNCTION update_client_on_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  UPDATE clients SET last_contact_date = NEW.activity_date
  WHERE id = NEW.client_id AND (last_contact_date IS NULL OR last_contact_date < NEW.activity_date);

  IF NEW.stage_after IS NOT NULL AND NEW.stage_after IS DISTINCT FROM NEW.stage_before THEN
    INSERT INTO stage_transitions (client_id, from_stage, to_stage, transition_date, triggered_by_activity)
    VALUES (NEW.client_id, NEW.stage_before, NEW.stage_after, NEW.activity_date, NEW.id);

    UPDATE clients SET current_stage = NEW.stage_after WHERE id = NEW.client_id;
  END IF;

  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_update_client_on_activity ON sales_activities;
CREATE TRIGGER trg_update_client_on_activity
  AFTER INSERT ON sales_activities
  FOR EACH ROW EXECUTE FUNCTION update_client_on_activity();

-- view: client_activity_summary
CREATE OR REPLACE VIEW client_activity_summary AS
SELECT
  c.id AS client_id,
  c.name AS client_name,
  c.current_stage,
  c.lifecycle_stage,
  c.dream100,
  c.last_contact_date,
  COUNT(a.id) AS total_activities,
  COUNT(a.id) FILTER (WHERE a.activity_date >= CURRENT_DATE - INTERVAL '30 days') AS activities_30d,
  COUNT(a.id) FILTER (WHERE a.activity_type IN ('meeting', 'visit')) AS meetings,
  COUNT(a.id) FILTER (WHERE a.activity_type = 'sample_send') AS samples_sent,
  COALESCE(SUM(a.value_generated), 0) AS total_value_generated,
  MAX(a.activity_date) AS most_recent_activity
FROM clients c
LEFT JOIN sales_activities a ON a.client_id = c.id
GROUP BY c.id, c.name, c.current_stage, c.lifecycle_stage, c.dream100, c.last_contact_date;

-- view: sales_funnel
CREATE OR REPLACE VIEW sales_funnel AS
SELECT
  current_stage,
  COUNT(*) AS client_count,
  COUNT(*) FILTER (WHERE dream100) AS dream100_count,
  COUNT(*) FILTER (WHERE last_contact_date >= CURRENT_DATE - INTERVAL '14 days') AS recent_count
FROM clients
WHERE active = true
GROUP BY current_stage
ORDER BY
  CASE current_stage
    WHEN 'prospecting' THEN 1
    WHEN 'rapport' THEN 2
    WHEN 'needs' THEN 3
    WHEN 'presentation' THEN 4
    WHEN 'objection' THEN 5
    WHEN 'closing' THEN 6
    WHEN 'follow_up' THEN 7
  END;

-- RLS
ALTER TABLE sales_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_objections ENABLE ROW LEVEL SECURITY;
ALTER TABLE need_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_kpi_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_sales_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE stage_transitions ENABLE ROW LEVEL SECURITY;

-- RLS policies
DROP POLICY IF EXISTS sales_activities_select ON sales_activities;
CREATE POLICY sales_activities_select ON sales_activities FOR SELECT USING (
  current_user_role() IN ('ceo', 'executive') OR agent_id = auth.uid()
);

DROP POLICY IF EXISTS sales_activities_insert ON sales_activities;
CREATE POLICY sales_activities_insert ON sales_activities FOR INSERT WITH CHECK (
  current_user_role() IN ('ceo', 'executive', 'employee', 'ai_agent')
);

DROP POLICY IF EXISTS sales_activities_update ON sales_activities;
CREATE POLICY sales_activities_update ON sales_activities FOR UPDATE USING (
  current_user_role() IN ('ceo', 'executive') OR agent_id = auth.uid()
);

DROP POLICY IF EXISTS sales_objections_all ON sales_objections;
CREATE POLICY sales_objections_all ON sales_objections FOR ALL USING (
  current_user_role() IN ('ceo', 'executive') OR agent_id = auth.uid()
);

DROP POLICY IF EXISTS need_cards_all ON need_cards;
CREATE POLICY need_cards_all ON need_cards FOR ALL USING (
  current_user_role() IN ('ceo', 'executive') OR agent_id = auth.uid()
);

DROP POLICY IF EXISTS kpi_snapshots_select ON sales_kpi_snapshots;
CREATE POLICY kpi_snapshots_select ON sales_kpi_snapshots FOR SELECT USING (
  current_user_role() IN ('ceo', 'executive') OR agent_id = auth.uid()
);

DROP POLICY IF EXISTS ai_sales_rec_all ON ai_sales_recommendations;
CREATE POLICY ai_sales_rec_all ON ai_sales_recommendations FOR ALL USING (
  current_user_role() IN ('ceo', 'executive') OR agent_id = auth.uid()
);

DROP POLICY IF EXISTS stage_transitions_select ON stage_transitions;
CREATE POLICY stage_transitions_select ON stage_transitions FOR SELECT USING (
  current_user_role() IN ('ceo', 'executive', 'employee', 'ai_agent')
);

GRANT INSERT ON stage_transitions TO supabase_auth_admin;
GRANT UPDATE ON clients TO supabase_auth_admin;
