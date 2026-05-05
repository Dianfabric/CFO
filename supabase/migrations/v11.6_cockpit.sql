-- v1.1 CEO Cockpit Migration (#7)
-- Apply via Supabase SQL Editor.

-- 1) 1:1 미팅 노트 (캠벨 신뢰 보호 — 작성자 본인만)
CREATE TABLE IF NOT EXISTS one_on_one_notes (
  id SERIAL PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES profiles(id),
  counterpart_id UUID REFERENCES profiles(id),
  counterpart_name TEXT,
  meeting_date DATE NOT NULL DEFAULT CURRENT_DATE,
  duration_minutes INTEGER,
  agenda TEXT,
  rapport TEXT,
  performance TEXT,
  feedback_given TEXT,
  feedback_received TEXT,
  decisions TEXT,
  next_steps TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_one_on_one_owner_date ON one_on_one_notes(owner_id, meeting_date DESC);

-- 2) 자기경영 5가지 점검 (드러커)
CREATE TABLE IF NOT EXISTS self_mgmt_checkins (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id),
  checkin_date DATE NOT NULL DEFAULT CURRENT_DATE,
  period_type TEXT DEFAULT 'weekly',
  time_management_score INTEGER CHECK (time_management_score BETWEEN 1 AND 5),
  time_management_note TEXT,
  contribution_score INTEGER CHECK (contribution_score BETWEEN 1 AND 5),
  contribution_note TEXT,
  strengths_score INTEGER CHECK (strengths_score BETWEEN 1 AND 5),
  strengths_note TEXT,
  priorities_score INTEGER CHECK (priorities_score BETWEEN 1 AND 5),
  priorities_note TEXT,
  decisions_score INTEGER CHECK (decisions_score BETWEEN 1 AND 5),
  decisions_note TEXT,
  overall_reflection TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, checkin_date, period_type)
);

CREATE INDEX IF NOT EXISTS idx_self_checkins_user_date ON self_mgmt_checkins(user_id, checkin_date DESC);

-- 3) profiles 확장 — 강점·텔레그램·발송 시각
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS strengths_description TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS strengths_evidence TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS strengths_blindspots TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telegram_enabled BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS morning_briefing_time TIME DEFAULT '07:00:00';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS evening_note_time TIME DEFAULT '21:00:00';

-- 4) RLS — 1:1 노트는 매우 엄격 (작성자 본인만)
ALTER TABLE one_on_one_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS one_on_one_select_own ON one_on_one_notes;
CREATE POLICY one_on_one_select_own ON one_on_one_notes FOR SELECT USING (
  owner_id = auth.uid()
);

DROP POLICY IF EXISTS one_on_one_insert_own ON one_on_one_notes;
CREATE POLICY one_on_one_insert_own ON one_on_one_notes FOR INSERT WITH CHECK (
  owner_id = auth.uid()
);

DROP POLICY IF EXISTS one_on_one_update_own ON one_on_one_notes;
CREATE POLICY one_on_one_update_own ON one_on_one_notes FOR UPDATE USING (
  owner_id = auth.uid()
);

DROP POLICY IF EXISTS one_on_one_delete_own ON one_on_one_notes;
CREATE POLICY one_on_one_delete_own ON one_on_one_notes FOR DELETE USING (
  owner_id = auth.uid()
);

-- 자기경영 점검도 본인만 (자기성찰 데이터)
ALTER TABLE self_mgmt_checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS self_checkin_own ON self_mgmt_checkins;
CREATE POLICY self_checkin_own ON self_mgmt_checkins FOR ALL USING (
  user_id = auth.uid()
);
