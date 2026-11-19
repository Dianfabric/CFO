// Explicit fixtures test UI behavior without changing any DB rows.
// PLAYWRIGHT_MODULE=/absolute/path/to/playwright node tests/fabric-price-browser.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
(async()=>{
const browser=await chromium.launch({headless:true,channel:'chrome'});
const context=await browser.newContext();const page=await context.newPage();
const base=process.env.BASE_URL || 'http://localhost:3107';
const fixtures=Array.from({length:205},(_,i)=>({id:String(i+1),product_name:i<2?'LUMI':`FABRIC ${i}`,brand:i===1?'BRAND B':'BRAND A',sell_price:i===1?null:i===2?0:22000,dealer_price:i===0?null:i===1?0:15000,search_alias:i===2?'Woodstock':null}));
let pageCalls=[];let slow=false;
await page.route('**/api/fabric-prices?*',async route=>{
 const url=new URL(route.request().url()),p=Number(url.searchParams.get('page')||1),q=url.searchParams.get('query')||'',multi=url.searchParams.get('multiQuery')||'';
 pageCalls.push({q,multi,p});let filtered=q==='OTHER'?[fixtures[2]]:q==='SLOW'?[fixtures[4]]:fixtures;
 if(multi) filtered=[fixtures[2],fixtures[0],fixtures[1]];
 const data={rows:filtered.slice((p-1)*100,p*100),summary:{total:205,ricky:0,rickyNew:0,missingCost:0,missingSell:1},brands:['BRAND A','BRAND B'],brandCounts:[],matchStatuses:[],missingTerms:multi?['MISSING']:[],pagination:{page:p,pageSize:100,total:filtered.length,totalPages:Math.ceil(filtered.length/100)}};
 if((q==='SLOW') || (slow && p===2)) await new Promise(r=>setTimeout(r,900));
 await route.fulfill({json:data}).catch(()=>{});
});
const log=s=>console.log('PASS',s);
await page.goto(base+'/products');await page.waitForFunction(()=>document.querySelectorAll('tbody input[type=checkbox]').length===100);
log('initial visible page exactly 100');
await page.locator('tbody input').nth(0).check();await page.locator('tbody input').nth(1).check();
assert.equal(await page.getByRole('dialog').count(),0);await page.getByText('선택 2건',{exact:true}).waitFor();log('same-name brands independently selectable; checkbox does not open drawer');
await page.getByPlaceholder('원단명 / Alias / 한글명 검색...').fill('OTHER');await page.waitForFunction(()=>document.querySelectorAll('tbody input').length===1);
await page.getByRole('button',{name:'선택 단가 복사',exact:true}).click();
const preview=page.getByLabel('단가 복사 미리보기');assert.equal(await preview.inputValue(),'LUMI — 22,000원/Y\nLUMI — 단가 미등록');log('selection retained across search; brand and cost absent');
await page.getByLabel('대리점가로 복사',{exact:true}).check();assert.equal(await preview.count(),0);
await page.getByRole('button',{name:'선택 단가 복사',exact:true}).click();assert.equal(await preview.inputValue(),'LUMI — 단가 미등록\nLUMI — 0원/Y');log('dealer toggle invalidates old preview; null no fallback and zero preserved');
await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('denied')}}}));
await page.getByRole('button',{name:'미리보기 내용 복사',exact:true}).click();await page.getByRole('status').filter({hasText:'클립보드 복사에 실패'}).waitFor();log('clipboard failure visible and preview retained');
await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copiedText=text}}}));
await page.getByRole('button',{name:'미리보기 내용 복사',exact:true}).click();assert.equal(await page.evaluate(()=>window.copiedText),'LUMI — 단가 미등록\nLUMI — 0원/Y');log('actual clipboard call receives only preview text');
await page.getByPlaceholder('원단명 / Alias / 한글명 검색...').fill('');await page.waitForFunction(()=>document.querySelectorAll('tbody input').length===100);
pageCalls=[];await page.getByRole('button',{name:'전체 단가 복사',exact:true}).click();await preview.waitFor();assert.equal((await preview.inputValue()).split('\n').length,205);assert.deepEqual(pageCalls.map(x=>x.p),[1,2,3]);assert.ok((await preview.inputValue()).startsWith('LUMI — 단가 미등록\nLUMI — 0원/Y'));log('ALL copies all 205 rows via pages 1,2,3 with dealer mode');
await page.getByLabel('대리점가로 복사',{exact:true}).uncheck();await page.getByRole('button',{name:'전체 단가 복사',exact:true}).click();await preview.waitFor();assert.equal((await preview.inputValue()).split('\n')[2],'FABRIC 2 — 0원/Y');log('ALL sell mode and zero preserved');
await page.getByPlaceholder('원단명 / Alias / 한글명 검색...').fill('SLOW');await page.waitForTimeout(380);await page.getByPlaceholder('원단명 / Alias / 한글명 검색...').fill('OTHER');await page.waitForTimeout(1400);assert.equal(await page.locator('tbody tr').count(),1);assert.ok((await page.locator('tbody').innerText()).includes('FABRIC 2'));log('late old search response cannot replace new result');
await page.getByPlaceholder('원단명 / Alias / 한글명 검색...').fill('');await page.waitForFunction(()=>document.querySelectorAll('tbody input').length===100);slow=true;pageCalls=[];
await page.getByRole('button',{name:/더보기/}).evaluate(el=>{el.click();el.click()});await page.waitForTimeout(1200);assert.equal(pageCalls.filter(x=>x.p===2).length,1);assert.equal(await page.locator('tbody tr').count(),200);log('double more-click only requests page once and no duplicate rows');
await page.getByRole('button',{name:'전체 단가 복사',exact:true}).click();await page.waitForTimeout(150);await page.getByPlaceholder('원단명 / Alias / 한글명 검색...').fill('OTHER');await page.waitForTimeout(1300);assert.equal(await preview.count(),0);log('filter change cancels in-flight ALL preview');
await page.getByLabel('여러 원단 검색',{exact:true}).check();await page.getByLabel('여러 원단 검색어',{exact:true}).fill('LE AURORA, LUMI\nWoodstock\tMISSING');await page.getByText('미검색 (현재 필터 기준): MISSING',{exact:true}).waitFor();assert.ok((await page.locator('tbody tr').first().innerText()).includes('FABRIC 2'));log('multi textarea sends comma/newline/tab and displays missing/input-order rows');
await page.getByRole('button',{name:'선택해제',exact:true}).click();await page.getByText('선택 0건',{exact:true}).waitFor();log('clear selection');
await page.screenshot({path:process.env.SCREENSHOT || '/Users/dian/.hermes/profiles/musiki/work/cfo-multi-price-fixture-ui.png',fullPage:true});
await browser.close();console.log('UI FIXTURE TESTS PASSED');
})().catch(e=>{console.error(e);process.exit(1)});
