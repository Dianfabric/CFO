export type ExhibitionEvent = {
  slug: string;
  name: string;
  leadCount: number;
};

export type ExhibitionLead = {
  id: string;
  email: string | null;
  kakaoEmail: string | null;
  name: string | null;
  phone: string | null;
  companyName: string | null;
  jobTitle: string | null;
  favoriteFabrics: string | null;
  provider: string | null;
  profileCompleted: boolean;
  createdAt: string | null;
};

type EventRow = {
  id: string;
  slug: string;
  name: string;
  starts_on: string | null;
  ends_on: string | null;
};
type CatalogCustomerRow = {
  id: string;
  email: string | null;
  kakao_email: string | null;
  name: string | null;
  phone: string | null;
  company_name: string | null;
  position: string | null;
  favorite_fabrics: string | null;
  provider: string | null;
  profile_completed: boolean;
  created_at: string | null;
};

function config() {
  const url = process.env.SUPABASE_FABRIC_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_FABRIC_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  return url && key ? { url: url.replace(/\/$/, ""), key } : null;
}

function headers(key: string): HeadersInit {
  return { apikey: key, Authorization: `Bearer ${key}` };
}

function exhibitionDateRange(event: EventRow) {
  if (!event.starts_on || !event.ends_on) return null;
  const start = new Date(`${event.starts_on}T00:00:00+09:00`);
  const endExclusive = new Date(`${event.ends_on}T00:00:00+09:00`);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
  if (Number.isNaN(start.getTime()) || Number.isNaN(endExclusive.getTime())) return null;
  return { start: start.toISOString(), endExclusive: endExclusive.toISOString() };
}

async function getEventRows(): Promise<EventRow[]> {
  const env = config();
  if (!env) return [];
  const query = new URLSearchParams({ select: "id,slug,name,starts_on,ends_on", order: "starts_on.desc.nullslast,created_at.desc" });
  const response = await fetch(`${env.url}/rest/v1/exhibition_events?${query}`, { headers: headers(env.key), cache: "no-store" });
  if (!response.ok) throw new Error("행사 정보를 불러오지 못했습니다.");
  return (await response.json()) as EventRow[];
}

export async function getExhibitionLeads(slug: string): Promise<ExhibitionLead[]> {
  const env = config();
  if (!env) return [];
  const event = (await getEventRows()).find((item) => item.slug === slug);
  const range = event ? exhibitionDateRange(event) : null;
  if (!range) return [];

  const query = new URLSearchParams({
    select: "id,email,kakao_email,name,phone,company_name,position,favorite_fabrics,provider,profile_completed,created_at",
    order: "created_at.desc",
  });
  query.append("created_at", `gte.${range.start}`);
  query.append("created_at", `lt.${range.endExclusive}`);
  const response = await fetch(`${env.url}/rest/v1/catalog_customers?${query}`, { headers: headers(env.key), cache: "no-store" });
  if (!response.ok) throw new Error("카탈로그 가입 고객 정보를 불러오지 못했습니다.");
  const rows = (await response.json()) as CatalogCustomerRow[];
  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    kakaoEmail: row.kakao_email,
    name: row.name,
    phone: row.phone,
    companyName: row.company_name,
    jobTitle: row.position,
    favoriteFabrics: row.favorite_fabrics,
    provider: row.provider,
    profileCompleted: row.profile_completed,
    createdAt: row.created_at,
  }));
}

export async function getExhibitionEvents(): Promise<ExhibitionEvent[]> {
  const events = await getEventRows();
  return Promise.all(events.map(async (event) => ({
    slug: event.slug,
    name: event.name,
    leadCount: (await getExhibitionLeads(event.slug)).length,
  })));
}
