// 도메인 타입 (Supabase row 매핑)

export type EventStatus = "draft" | "collected" | "drawn" | "claiming" | "closed";

export interface EventRow {
  id: string;
  title: string;
  urls: string[];
  winner_count: number;
  backup_count: number;
  dedupe: boolean;
  excluded: string[];
  status: EventStatus;
  seed: string | null;
  created_at: string;
}

export interface CommentRow {
  id: number;
  event_id: string;
  username: string;
  text: string | null;
  commented_at: string | null;
  source: "apify" | "paste" | "seed";
  created_at: string;
}

export interface WinnerRow {
  id: number;
  event_id: string;
  username: string;
  rank: number;
  is_backup: boolean;
  drawn_at: string;
}

export const STATUS_LABEL: Record<EventStatus, string> = {
  draft: "작성중",
  collected: "수집완료",
  drawn: "추첨완료",
  claiming: "정보수집중",
  closed: "종료",
};
