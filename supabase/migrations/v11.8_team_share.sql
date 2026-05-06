-- v1.1 Team Share Migration (#8)
-- Apply via Supabase SQL Editor.

-- 1) 공지 (대표가 작성, 슬랙으로 발송)
CREATE TABLE IF NOT EXISTS team_announcements (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT,
  importance TEXT DEFAULT 'normal',
  target_channel TEXT DEFAULT 'employees',
  include_in_daily BOOLEAN DEFAULT true,
  include_in_weekly BOOLEAN DEFAULT false,
  scheduled_date DATE DEFAULT CURRENT_DATE,
  expires_at DATE,
  sent_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_announcements_scheduled ON team_announcements(scheduled_date DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_active ON team_announcements(scheduled_date, expires_at);

-- 2) 슬랙 설정 (singleton id=1)
CREATE TABLE IF NOT EXISTS slack_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled BOOLEAN DEFAULT false,
  employees_webhook TEXT,
  executives_webhook TEXT,
  ceo_webhook TEXT,
  daily_time TIME DEFAULT '09:00:00',
  weekly_time TIME DEFAULT '10:00:00',
  monthly_time TIME DEFAULT '10:00:00',
  daily_enabled BOOLEAN DEFAULT true,
  weekly_enabled BOOLEAN DEFAULT true,
  monthly_enabled BOOLEAN DEFAULT true,
  alerts_enabled BOOLEAN DEFAULT true,
  big_deal_threshold NUMERIC(12,2) DEFAULT 10000000,
  overdue_alert_days INTEGER DEFAULT 90,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES profiles(id)
);

INSERT INTO slack_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 3) 발송 이력
CREATE TABLE IF NOT EXISTS slack_send_log (
  id SERIAL PRIMARY KEY,
  target_channel TEXT NOT NULL,
  message_type TEXT NOT NULL,
  payload JSONB,
  status TEXT DEFAULT 'pending',
  status_code INTEGER,
  error TEXT,
  sent_at TIMESTAMPTZ DEFAULT now(),
  triggered_by UUID REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_slack_log_sent ON slack_send_log(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_slack_log_status ON slack_send_log(status);

-- 4) RLS — 공지·슬랙은 CEO/임원만 편집
ALTER TABLE team_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE slack_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE slack_send_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS announcements_select ON team_announcements;
CREATE POLICY announcements_select ON team_announcements FOR SELECT USING (
  current_user_role() IN ('ceo', 'executive', 'employee', 'ai_agent')
);

DROP POLICY IF EXISTS announcements_modify ON team_announcements;
CREATE POLICY announcements_modify ON team_announcements FOR ALL USING (
  current_user_role() IN ('ceo', 'executive')
);

DROP POLICY IF EXISTS slack_settings_select ON slack_settings;
CREATE POLICY slack_settings_select ON slack_settings FOR SELECT USING (
  current_user_role() IN ('ceo', 'executive')
);

DROP POLICY IF EXISTS slack_settings_modify ON slack_settings;
CREATE POLICY slack_settings_modify ON slack_settings FOR ALL USING (
  current_user_role() IN ('ceo', 'executive')
);

DROP POLICY IF EXISTS slack_log_select ON slack_send_log;
CREATE POLICY slack_log_select ON slack_send_log FOR SELECT USING (
  current_user_role() IN ('ceo', 'executive')
);

DROP POLICY IF EXISTS slack_log_insert ON slack_send_log;
CREATE POLICY slack_log_insert ON slack_send_log FOR INSERT WITH CHECK (
  current_user_role() IN ('ceo', 'executive', 'ai_agent')
);
