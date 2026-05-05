-- v1.1 Marketing Migration (#2b)
-- Apply via Supabase SQL Editor.

-- Brand identity (singleton)
CREATE TABLE IF NOT EXISTS brand_identity (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  big_idea TEXT,
  brand_persona TEXT,
  voice_tone TEXT,
  story_origin TEXT,
  story_mission TEXT,
  story_vision TEXT,
  visual_primary_color TEXT,
  visual_secondary_color TEXT,
  visual_accent_color TEXT,
  visual_font_heading TEXT,
  visual_font_body TEXT,
  visual_image_style TEXT,
  visual_logo_url TEXT,
  target_persona_primary TEXT,
  target_persona_secondary TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES profiles(id)
);

INSERT INTO brand_identity (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Content items (Instagram, blog, lookbook, video, newsletter)
CREATE TABLE IF NOT EXISTS content_items (
  id SERIAL PRIMARY KEY,
  channel TEXT NOT NULL,
  title TEXT NOT NULL,
  publish_date DATE,
  status TEXT DEFAULT 'idea',
  hook TEXT,
  story TEXT,
  offer TEXT,
  caption TEXT,
  hashtags TEXT[],
  url TEXT,
  thumbnail_url TEXT,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  target_segments INTEGER[],
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_items_channel ON content_items(channel);
CREATE INDEX IF NOT EXISTS idx_content_items_status ON content_items(status);
CREATE INDEX IF NOT EXISTS idx_content_items_publish ON content_items(publish_date DESC);

-- Channel snapshots (weekly/monthly KPI)
CREATE TABLE IF NOT EXISTS channel_snapshots (
  id SERIAL PRIMARY KEY,
  channel TEXT NOT NULL,
  snapshot_date DATE NOT NULL,
  followers INTEGER DEFAULT 0,
  followers_delta INTEGER DEFAULT 0,
  posts_count INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  engagement_rate NUMERIC(5,2),
  click_through_rate NUMERIC(5,2),
  inquiries_count INTEGER DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(channel, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_channel_snapshots_channel ON channel_snapshots(channel, snapshot_date DESC);

-- Hook/Story/Offer marketing scripts (Russell)
CREATE TABLE IF NOT EXISTS marketing_scripts (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  target_segment_id INTEGER REFERENCES segments(id),
  hook TEXT,
  story TEXT,
  offer TEXT,
  call_to_action TEXT,
  context TEXT,
  used_count INTEGER DEFAULT 0,
  effectiveness_score INTEGER CHECK (effectiveness_score BETWEEN 1 AND 5),
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scripts_segment ON marketing_scripts(target_segment_id);

-- RLS
ALTER TABLE brand_identity ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_scripts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS brand_identity_all ON brand_identity;
CREATE POLICY brand_identity_all ON brand_identity FOR ALL USING (
  current_user_role() IN ('ceo', 'executive', 'employee', 'ai_agent')
);

DROP POLICY IF EXISTS content_items_all ON content_items;
CREATE POLICY content_items_all ON content_items FOR ALL USING (
  current_user_role() IN ('ceo', 'executive', 'employee', 'ai_agent')
);

DROP POLICY IF EXISTS channel_snapshots_all ON channel_snapshots;
CREATE POLICY channel_snapshots_all ON channel_snapshots FOR ALL USING (
  current_user_role() IN ('ceo', 'executive', 'employee', 'ai_agent')
);

DROP POLICY IF EXISTS marketing_scripts_all ON marketing_scripts;
CREATE POLICY marketing_scripts_all ON marketing_scripts FOR ALL USING (
  current_user_role() IN ('ceo', 'executive', 'employee', 'ai_agent')
);

-- View: channel growth (compare last vs previous snapshot)
CREATE OR REPLACE VIEW channel_growth AS
WITH ranked AS (
  SELECT
    channel,
    snapshot_date,
    followers,
    posts_count,
    reach,
    impressions,
    engagement_rate,
    inquiries_count,
    ROW_NUMBER() OVER (PARTITION BY channel ORDER BY snapshot_date DESC) AS rn
  FROM channel_snapshots
)
SELECT
  cur.channel,
  cur.snapshot_date AS latest_date,
  cur.followers AS current_followers,
  prev.followers AS prev_followers,
  COALESCE(cur.followers - prev.followers, 0) AS followers_delta,
  cur.posts_count,
  cur.reach,
  cur.engagement_rate,
  cur.inquiries_count
FROM ranked cur
LEFT JOIN ranked prev ON cur.channel = prev.channel AND prev.rn = 2
WHERE cur.rn = 1;
