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

const EVENT = { slug: "space-design-fair-2026-08", name: "공간디자인페어 2026.08" };
const EVENT_TAG = `[전시VIP][${EVENT.name}]`;

type AirtableRecord = {
  id: string;
  createdTime?: string;
  fields: Record<string, unknown>;
};

function config() {
  const token = process.env.DIAN_VIP_AIRTABLE_TOKEN;
  const baseId = process.env.DIAN_VIP_AIRTABLE_BASE_ID;
  const tableId = process.env.DIAN_VIP_AIRTABLE_TABLE_ID;
  if (!token || !baseId || !tableId) return null;
  return { token, baseId, tableId };
}

function field(record: AirtableRecord, name: string) {
  const value = record.fields[name];
  return typeof value === "string" ? value : "";
}

function jobTitle(note: string) {
  const match = note.match(/\[직책\]\s*([\s\S]*?)\s*\[마케팅수신동의\]/);
  return match?.[1]?.trim() ?? '';
}

function consentedAt(note: string) {
  const marker = "[마케팅수신동의] ";
  const index = note.indexOf(marker);
  return index === -1 ? null : note.slice(index + marker.length).trim() || null;
}

export async function getExhibitionLeads(slug = EVENT.slug): Promise<ExhibitionLead[]> {
  if (slug !== EVENT.slug) return [];
  const env = config();
  if (!env) return [];

  const formula = `FIND('${EVENT_TAG}', {비고})`;
  const url = new URL(`https://api.airtable.com/v0/${env.baseId}/${env.tableId}`);
  url.searchParams.set("filterByFormula", formula);
  url.searchParams.set("sort[0][field]", "등록 일시");
  url.searchParams.set("sort[0][direction]", "desc");
  url.searchParams.append("fields[]", "거래처 이름");
  url.searchParams.append("fields[]", "직군");
  url.searchParams.append("fields[]", "전화번호");
  url.searchParams.append("fields[]", "E-mail");
  url.searchParams.append("fields[]", "비고");

  const response = await fetch(url, { headers: { Authorization: `Bearer ${env.token}` }, cache: "no-store" });
  if (!response.ok) throw new Error("행사 고객 정보를 불러오지 못했습니다.");
  const data = (await response.json()) as { records?: AirtableRecord[] };
  return (data.records ?? []).map((record) => {
    const note = field(record, "비고");
    const agreedAt = consentedAt(note);
    return {
      id: record.id,
      companyName: field(record, "거래처 이름"),
      jobTitle: jobTitle(note),
      phone: field(record, "전화번호"),
      email: field(record, "E-mail"),
      marketingConsent: Boolean(agreedAt),
      consentedAt: agreedAt,
      createdAt: record.createdTime ?? null,
    };
  });
}

export async function getExhibitionEvents(): Promise<ExhibitionEvent[]> {
  const leads = await getExhibitionLeads();
  return [{ ...EVENT, leadCount: leads.length }];
}
