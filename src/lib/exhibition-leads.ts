export type ExhibitionEvent = {
  slug: string;
  name: string;
  leadCount: number;
};

export type ExhibitionLead = {
  id: string;
  companyName: string;
  jobTitle: string;
  phone: string;
  email: string;
  marketingConsent: boolean;
  consentedAt: string | null;
  createdAt: string | null;
};

type EventRow = { id: string; slug: string; name: string };
type LeadRow = {
  id: string;
  company_name: string;
  job_title: string;
  phone: string;
  email: string;
  marketing_consent: boolean;
  marketing_consent_at: string | null;
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

async function getEventRows(): Promise<EventRow[]> {
  const env = config();
  if (!env) return [];
  const query = new URLSearchParams({ select: "id,slug,name", order: "starts_on.desc.nullslast,created_at.desc" });
  const response = await fetch(`${env.url}/rest/v1/exhibition_events?${query}`, { headers: headers(env.key), cache: "no-store" });
  if (!response.ok) throw new Error("행사 정보를 불러오지 못했습니다.");
  return (await response.json()) as EventRow[];
}

export async function getExhibitionLeads(slug: string): Promise<ExhibitionLead[]> {
  const env = config();
  if (!env) return [];
  const event = (await getEventRows()).find((item) => item.slug === slug);
  if (!event) return [];
  const query = new URLSearchParams({
    select: "id,company_name,job_title,phone,email,marketing_consent,marketing_consent_at,created_at",
    event_id: `eq.${event.id}`,
    marketing_consent: "eq.true",
    order: "created_at.desc",
  });
  const response = await fetch(`${env.url}/rest/v1/exhibition_leads?${query}`, { headers: headers(env.key), cache: "no-store" });
  if (!response.ok) throw new Error("행사 고객 정보를 불러오지 못했습니다.");
  const rows = (await response.json()) as LeadRow[];
  return rows.map((row) => ({
    id: row.id,
    companyName: row.company_name,
    jobTitle: row.job_title,
    phone: row.phone,
    email: row.email,
    marketingConsent: row.marketing_consent,
    consentedAt: row.marketing_consent_at,
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
