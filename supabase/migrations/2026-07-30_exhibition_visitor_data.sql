-- ============================================================
-- 전시회 고객 등록 및 재방문 상담 이력
-- public API는 이 테이블을 직접 읽거나 쓰지 않는다.
-- 전시회 챗봇/CF0의 서버 Route Handler만 service_role로 접근한다.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.exhibition_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  starts_on DATE,
  ends_on DATE,
  venue TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.exhibition_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.exhibition_events(id) ON DELETE RESTRICT,
  company_name TEXT NOT NULL,
  job_title TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  marketing_consent BOOLEAN NOT NULL DEFAULT false,
  marketing_consent_at TIMESTAMPTZ,
  consent_version TEXT,
  source TEXT NOT NULL DEFAULT 'exhibition_chatbot',
  source_record_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT exhibition_leads_marketing_consent_time_ck
    CHECK (NOT marketing_consent OR marketing_consent_at IS NOT NULL),
  CONSTRAINT exhibition_leads_source_record_unique UNIQUE (source, source_record_id)
);

CREATE TABLE IF NOT EXISTS public.visitor_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.exhibition_events(id) ON DELETE RESTRICT,
  -- 브라우저에는 256-bit 무작위 토큰만 저장하고, DB에는 SHA-256 해시만 저장한다.
  visitor_token_hash CHAR(64) NOT NULL UNIQUE,
  language TEXT NOT NULL DEFAULT 'ko' CHECK (language IN ('ko', 'en')),
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.visitor_chat_messages (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.visitor_chat_sessions(id) ON DELETE CASCADE,
  client_message_id UUID,
  role TEXT NOT NULL CHECK (role IN ('visitor', 'assistant')),
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 4000),
  response_mode TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT visitor_chat_messages_client_dedupe UNIQUE (session_id, client_message_id)
);

CREATE INDEX IF NOT EXISTS exhibition_leads_event_created_idx
  ON public.exhibition_leads (event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS exhibition_leads_email_idx
  ON public.exhibition_leads (email);
CREATE INDEX IF NOT EXISTS exhibition_leads_phone_idx
  ON public.exhibition_leads (phone);
CREATE INDEX IF NOT EXISTS visitor_chat_sessions_event_last_seen_idx
  ON public.visitor_chat_sessions (event_id, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS visitor_chat_messages_session_created_idx
  ON public.visitor_chat_messages (session_id, created_at, id);

CREATE OR REPLACE FUNCTION public.set_exhibition_visitor_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_exhibition_events_updated_at ON public.exhibition_events;
CREATE TRIGGER trg_exhibition_events_updated_at
BEFORE UPDATE ON public.exhibition_events
FOR EACH ROW EXECUTE FUNCTION public.set_exhibition_visitor_updated_at();

DROP TRIGGER IF EXISTS trg_exhibition_leads_updated_at ON public.exhibition_leads;
CREATE TRIGGER trg_exhibition_leads_updated_at
BEFORE UPDATE ON public.exhibition_leads
FOR EACH ROW EXECUTE FUNCTION public.set_exhibition_visitor_updated_at();

DROP TRIGGER IF EXISTS trg_visitor_chat_sessions_updated_at ON public.visitor_chat_sessions;
CREATE TRIGGER trg_visitor_chat_sessions_updated_at
BEFORE UPDATE ON public.visitor_chat_sessions
FOR EACH ROW EXECUTE FUNCTION public.set_exhibition_visitor_updated_at();

-- 고객 개인정보/대화는 브라우저 anon role에 공개하지 않는다.
ALTER TABLE public.exhibition_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exhibition_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitor_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitor_chat_messages ENABLE ROW LEVEL SECURITY;

-- 현재 행사 초기값. 재실행해도 기존 행사 정보는 유지한다.
INSERT INTO public.exhibition_events (slug, name, is_active)
VALUES ('space-design-fair-2026-08', '공간디자인페어 2026.08', true)
ON CONFLICT (slug) DO NOTHING;
