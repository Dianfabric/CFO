const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try {
 const context=await browser.newContext({permissions:['clipboard-read','clipboard-write']}),page=await context.newPage();page.setDefaultTimeout(10000);
 const fixtures=Array.from({length:205},(_,i)=>({id:'same-id',product_name:'KOSHER',input_term:`kosher-${String(i).padStart(3,'0')}`,copy_name:`kosher-${String(i).padStart(3,'0')}`,brand:'PRIVATE BRAND',cost_usd:777,sell_price:i===0?null:i===1?0:35000,dealer_price:i===1?null:i===0?0:30000}));
 const calls=[];
 await page.route('**/api/fabric-prices?*',async route=>{const p=Number(new URL(route.request().url()).searchParams.get('page')||1);calls.push(p);await route.fulfill({json:{rows:fixtures.slice((p-1)*100,p*100),summary:{total:205,ricky:0,rickyNew:0,missingCost:0,missingSell:1},brands:[],brandCounts:[],matchStatuses:[],missingTerms:[],pagination:{page:p,pageSize:100,total:205,totalPages:3}}});});
 await page.goto((process.env.BASE_URL||'http://localhost:3111')+'/products');await page.waitForFunction(()=>document.querySelectorAll('tbody input').length===100);
 await page.locator('tbody input').nth(0).check();await page.locator('tbody input').nth(1).check();await page.getByText('선택 2건',{exact:true}).waitFor();
 const preview=page.getByLabel('단가 복사 미리보기');
 for(const checked of [false,true]) {
 await page.getByLabel('대리점가로 복사',{exact:true}).setChecked(checked);
 await page.getByRole('button',{name:'선택 두 가격 복사',exact:true}).click();await preview.waitFor();
 assert.equal(await preview.inputValue(),'kosher-000 단가 미등록 0/Y\nkosher-001 0/Y 단가 미등록');
 await page.getByRole('button',{name:'미리보기 내용 복사',exact:true}).click();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),await preview.inputValue());
 }
 console.log('PASS independent color selection, dual null/zero, dealer-independent clipboard/preview');
 calls.length=0;await page.getByRole('button',{name:'전체 두 가격 복사',exact:true}).click();await page.waitForFunction(()=>document.querySelector('textarea[aria-label="단가 복사 미리보기"]')?.value.split('\n').length===205);
 assert.deepEqual(calls,[1,2,3]);const output=await preview.inputValue();assert.equal(output.split('\n')[204],'kosher-204 35,000/Y 30,000/Y');assert.ok(!output.includes('PRIVATE'));assert.ok(!output.includes('777'));
 console.log('PASS dual all 205 color entries sharing row ID over 3 pages, no brand/cost');
 await page.getByRole('button',{name:'선택 단가 복사',exact:true}).click();assert.equal(await preview.inputValue(),'kosher-000 — 0원/Y\nkosher-001 — 단가 미등록');
 await page.screenshot({path:process.env.SCREENSHOT||'/Users/dian/.hermes/profiles/musiki/work/cfo-color-fixture.png',fullPage:true});
 console.log('COLOR UI FIXTURE PASS');
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
