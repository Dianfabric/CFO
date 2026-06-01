-- 1:1 미팅 — 대상자 컨펌 시각
-- target_confirmed_at 가 NULL 이면 미컨펌, TIMESTAMPTZ 가 있으면 컨펌됨
ALTER TABLE cycle_one_on_ones
  ADD COLUMN IF NOT EXISTS target_confirmed_at TIMESTAMPTZ;

NOTIFY pgrst, 'reload schema';
