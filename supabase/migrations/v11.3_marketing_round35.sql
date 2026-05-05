-- v1.1 Marketing Round 3.5 Migration
-- Apply via Supabase SQL Editor.

-- Marketing Dream 100 (target prospects: influencers, magazines, designers)
CREATE TABLE IF NOT EXISTS marketing_dream100 (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  prospect_type TEXT,
  segment_hint TEXT,
  current_status TEXT DEFAULT 'identified',
  influence_score INTEGER CHECK (influence_score BETWEEN 1 AND 10),
  contact_handle TEXT,
  contact_url TEXT,
  follower_count INTEGER,
  last_contact_date DATE,
  next_action TEXT,
  next_action_date DATE,
  notes TEXT,
  added_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_md100_status ON marketing_dream100(current_status);
CREATE INDEX IF NOT EXISTS idx_md100_type ON marketing_dream100(prospect_type);
CREATE INDEX IF NOT EXISTS idx_md100_score ON marketing_dream100(influence_score DESC);

-- Marketing Campaigns (seasons, product launches, newsletters, collabs)
CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  campaign_type TEXT,
  start_date DATE,
  end_date DATE,
  status TEXT DEFAULT 'planning',
  goal TEXT,
  target_segments INTEGER[],
  budget NUMERIC(12,2),
  actual_spend NUMERIC(12,2) DEFAULT 0,
  metrics_views INTEGER DEFAULT 0,
  metrics_conversions INTEGER DEFAULT 0,
  metrics_revenue NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_status ON marketing_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_type ON marketing_campaigns(campaign_type);
CREATE INDEX IF NOT EXISTS idx_campaigns_dates ON marketing_campaigns(start_date, end_date);

-- Link content_items to campaigns
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS campaign_id INTEGER REFERENCES marketing_campaigns(id);
CREATE INDEX IF NOT EXISTS idx_content_campaign ON content_items(campaign_id);

-- RLS
ALTER TABLE marketing_dream100 ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS md100_all ON marketing_dream100;
CREATE POLICY md100_all ON marketing_dream100 FOR ALL USING (
  current_user_role() IN ('ceo', 'executive', 'employee', 'ai_agent')
);

DROP POLICY IF EXISTS campaigns_all ON marketing_campaigns;
CREATE POLICY campaigns_all ON marketing_campaigns FOR ALL USING (
  current_user_role() IN ('ceo', 'executive', 'employee', 'ai_agent')
);

-- Campaign performance view
CREATE OR REPLACE VIEW campaign_performance AS
SELECT
  c.id,
  c.name,
  c.campaign_type,
  c.start_date,
  c.end_date,
  c.status,
  c.budget,
  c.actual_spend,
  c.metrics_views AS reported_views,
  c.metrics_conversions AS reported_conversions,
  c.metrics_revenue AS reported_revenue,
  COUNT(ci.id) AS content_count,
  COALESCE(SUM(ci.views), 0) AS aggregated_views,
  COALESCE(SUM(ci.likes), 0) AS aggregated_likes,
  COALESCE(SUM(ci.shares), 0) AS aggregated_shares,
  CASE
    WHEN c.actual_spend > 0 AND c.metrics_revenue > 0
      THEN ROUND((c.metrics_revenue / c.actual_spend)::numeric, 2)
    ELSE NULL
  END AS roi_multiplier
FROM marketing_campaigns c
LEFT JOIN content_items ci ON ci.campaign_id = c.id
GROUP BY c.id;
