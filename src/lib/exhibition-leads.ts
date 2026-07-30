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

export type CatalogCustomerDateFilter = {
  start?: string;
  end?: string;
};

function config() {
  const url = process.env.SUPABASE_FABRIC_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_FABRIC_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  return url && key ? { url: url.replace(/\/$/, ''), key } : null;
}

function headers(key: string): HeadersInit {
  return { apikey: key, Authorization: `Bearer ${key}` };
}

function kstStartOfDay(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const result = new Date(`${date}T00:00:00+09:00`);
  return Number.isNaN(result.getTime()) ? null : result;
}

function kstEndExclusive(date: string) {
  const result = kstStartOfDay(date);
  if (!result) return null;
  result.setUTCDate(result.getUTCDate() + 1);
  return result;
}

/** 카탈로그 전체 가입 고객. 날짜를 넣으면 KST 기준 해당 날짜를 포함해 필터한다. */
export async function getCatalogCustomers(filter: CatalogCustomerDateFilter = {}): Promise<ExhibitionLead[]> {
  const env = config();
  if (!env) return [];

  const query = new URLSearchParams({
    select: 'id,email,kakao_email,name,phone,company_name,position,favorite_fabrics,provider,profile_completed,created_at',
    order: 'created_at.desc',
  });
  const start = filter.start ? kstStartOfDay(filter.start) : null;
  const endExclusive = filter.end ? kstEndExclusive(filter.end) : null;
  if (start) query.append('created_at', `gte.${start.toISOString()}`);
  if (endExclusive) query.append('created_at', `lt.${endExclusive.toISOString()}`);

  const response = await fetch(`${env.url}/rest/v1/catalog_customers?${query}`, { headers: headers(env.key), cache: 'no-store' });
  if (!response.ok) throw new Error('카탈로그 가입 고객 정보를 불러오지 못했습니다.');
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
