-- v1.1 Pricing Promotions Migration (#4 ⑥)
-- Apply via Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS price_promotions (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  promo_type TEXT,
  start_date DATE,
  end_date DATE,
  status TEXT DEFAULT 'planning',
  -- targeting (any combination, NULL = no constraint)
  target_tier price_tier,
  target_line_id INTEGER REFERENCES product_lines(id),
  target_segment_id INTEGER REFERENCES segments(id),
  target_client_tier client_tier,
  -- discount
  discount_rate NUMERIC(5,2),
  discount_amount NUMERIC(12,2),
  min_quantity INTEGER,
  bundle_note TEXT,
  -- guards (PRD #4: luxury never discount)
  exclude_luxury BOOLEAN DEFAULT true,
  -- tracking
  uses_count INTEGER DEFAULT 0,
  total_discount_amount NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_promotions_status ON price_promotions(status);
CREATE INDEX IF NOT EXISTS idx_promotions_dates ON price_promotions(start_date, end_date);

-- RLS (CEO/executive only — discount policy is sensitive)
ALTER TABLE price_promotions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS promotions_select ON price_promotions;
CREATE POLICY promotions_select ON price_promotions FOR SELECT USING (
  current_user_role() IN ('ceo', 'executive', 'employee', 'ai_agent')
);

DROP POLICY IF EXISTS promotions_modify ON price_promotions;
CREATE POLICY promotions_modify ON price_promotions FOR ALL USING (
  current_user_role() IN ('ceo', 'executive')
);
