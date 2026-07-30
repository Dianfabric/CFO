import assert from 'node:assert/strict';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const outDir = '/tmp/dian-cfo-exhibition-leads-test-dist';
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

execFileSync('npx', [
  'tsc',
  'src/lib/exhibition-leads.ts',
  '--target', 'ES2022',
  '--module', 'NodeNext',
  '--moduleResolution', 'NodeNext',
  '--skipLibCheck',
  '--outDir', outDir,
], { cwd: '/Users/dian/CFO', stdio: 'inherit' });

assert.equal(existsSync(`${outDir}/exhibition-leads.js`), true);
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'test-service-key';

const requests = [];
global.fetch = async (input) => {
  const url = String(input);
  requests.push(url);
  if (url.includes('/exhibition_events?')) {
    return new Response(JSON.stringify([{
      id: 'event-1',
      slug: 'space-design-fair-2026-08',
      name: '공간디자인페어 2026.08',
      starts_on: '2026-08-05',
      ends_on: '2026-08-08',
    }]), { status: 200 });
  }
  if (url.includes('/catalog_customers?')) {
    return new Response(JSON.stringify([{
      id: 'customer-1',
      email: 'catalog@example.com',
      kakao_email: 'kakao@example.com',
      name: '홍길동',
      phone: '010-1234-5678',
      company_name: '디안',
      position: '과장',
      favorite_fabrics: '소파, 커튼',
      provider: 'kakao',
      profile_completed: true,
      created_at: '2026-08-06T00:00:00.000Z',
    }]), { status: 200 });
  }
  return new Response('not found', { status: 404 });
};

const mod = await import(`file://${outDir}/exhibition-leads.js`);
const leads = await mod.getExhibitionLeads('space-design-fair-2026-08');

assert.deepEqual(leads, [{
  id: 'customer-1',
  email: 'catalog@example.com',
  kakaoEmail: 'kakao@example.com',
  name: '홍길동',
  phone: '010-1234-5678',
  companyName: '디안',
  jobTitle: '과장',
  favoriteFabrics: '소파, 커튼',
  provider: 'kakao',
  profileCompleted: true,
  createdAt: '2026-08-06T00:00:00.000Z',
}]);

const catalogQuery = new URL(requests.find((url) => url.includes('/catalog_customers?')));
assert.deepEqual(catalogQuery.searchParams.getAll('created_at'), ['gte.2026-08-04T15:00:00.000Z', 'lt.2026-08-08T15:00:00.000Z']);
assert.equal(catalogQuery.searchParams.get('order'), 'created_at.desc');
assert.ok(catalogQuery.searchParams.get('select').includes('favorite_fabrics'));

console.log('exhibition leads tests passed');
