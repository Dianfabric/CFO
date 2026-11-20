const {test}=require('node:test'); const assert=require('node:assert/strict');
const ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpile(require('fs').readFileSync(f,'utf8'),{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}),f);
const tools=()=>require('../src/lib/fabric-price-tools.ts');
test('color entries preserve copy spelling and distinct selection/page identity',()=>{
 const a={id:9,product_name:'KOSHER',input_term:'kosher-05',copy_name:'kosher-05',sell_price:35000,dealer_price:30000};
 const b={...a,input_term:'Kosher#07',copy_name:'Kosher#07'};
 assert.equal(tools().formatPriceCopy([a],false),'kosher-05 — 35,000원/Y');
 assert.equal(tools().mergeFabricRows([a],[b,a]).length,2);
 let selected=tools().toggleFabricSelection(new Map(),a);selected=tools().toggleFabricSelection(selected,b);assert.equal(selected.size,2);
});
test('dual prices fixed sell then dealer, independent null/zero, raw name',()=>{
 assert.equal(tools().formatPriceCopy([{product_name:'wrong',copy_name:'KOSHER#05',sell_price:35000,dealer_price:30000}],true,true),'KOSHER#05 35,000/Y 30,000/Y');
 assert.equal(tools().formatPriceCopy([{product_name:'A',sell_price:null,dealer_price:0},{product_name:'B',sell_price:0,dealer_price:null}],false,true),'A 단가 미등록 0/Y\nB 0/Y 단가 미등록');
});
test('color parsing only trailing numeric delimiter; literal names exact take priority',()=>{
 const {fabricColorBase,resolveFabricTerm}=tools();
 assert.equal(fabricColorBase('kosher-05'),'kosher');assert.equal(fabricColorBase('Kosher#007'),'Kosher');
 assert.equal(fabricColorBase('SUN-DEW-04'),'SUN-DEW');
 for(const s of ['SUN-DEW','ABC-','ABC#','ABC-05 extra','ABC-Blue']) assert.equal(fabricColorBase(s),null);
 assert.deepEqual(resolveFabricTerm('MODEL-05',new Set(['model-05'])),{search:'MODEL-05',copy:'MODEL-05',exact:true});
 assert.deepEqual(resolveFabricTerm('kosher-05',new Set()),{search:'kosher',copy:'kosher-05',exact:false});
});
const rows=[{id:1,product_name:'LUMI',brand:'SECRET BRAND',sell_price:22000,dealer_price:null,cost_usd:777},{id:2,product_name:'LUMI',brand:'OTHER',sell_price:null,dealer_price:0},{id:3,product_name:'LE AURORA',sell_price:0,dealer_price:'15000'}];
test('copy allowlist excludes brand/cost, null never falls back and zero valid for both modes',()=>{
 assert.equal(tools().formatPriceCopy(rows,false),'LUMI — 22,000원/Y\nLUMI — 단가 미등록\nLE AURORA — 0원/Y');
 assert.equal(tools().formatPriceCopy(rows,true),'LUMI — 단가 미등록\nLUMI — 0원/Y\nLE AURORA — 15,000원/Y');
});
test('selection by ID survives search and keeps same-name brands distinct',()=>{
 const {toggleFabricSelection}=tools(); let selected=new Map();
 selected=toggleFabricSelection(selected,rows[0]); selected=toggleFabricSelection(selected,rows[1]);
 assert.equal(selected.size,2); assert.deepEqual([...selected.keys()],['1','2']);
 selected=toggleFabricSelection(selected,rows[0]); assert.deepEqual([...selected.keys()],['2']);
});
test('all pages dedupe IDs not names and reject incomplete/changing results',async()=>{
 const calls=[]; const result=await tools().collectFabricPages(async page=>{calls.push(page);return {rows:page===1?[rows[0],rows[1]]:[rows[1],rows[2]],pagination:{total:3,totalPages:2}}},new AbortController().signal);
 assert.deepEqual(calls,[1,2]);assert.equal(result.length,3);
 await assert.rejects(tools().collectFabricPages(async()=>({rows:[rows[0]],pagination:{total:3,totalPages:1}}),new AbortController().signal),/변경|누락/);
});
test('cancelled responses cannot complete all-copy',async()=>{
 const controller=new AbortController();
 await assert.rejects(tools().collectFabricPages(async()=>{controller.abort();return {rows, pagination:{total:3,totalPages:1}}},controller.signal),{name:'AbortError'});
});
test('multi SQL binds aliases/name/Korean terms safely and orders first match',()=>{
 const values=[];const s=tools().buildMultiSearchSQL(new Set(['product_name','search_alias','product_name_ko','brand']),['LE AURORA',"x%_'"],values);
 assert.deepEqual(values,['%LE AURORA%',"%x\\%\\_'%"]);assert.ok(s.predicates[0].includes('"search_alias" ILIKE $1'));assert.ok(s.predicates[0].includes('"product_name_ko"'));assert.ok(!s.predicates[0].includes('"brand"'));assert.match(s.order,/WHEN .*\$1.* THEN 0 WHEN .*\$2.* THEN 1/);assert.ok(!s.order.includes('AURORA'));
});
test('comma newline Excel tab preserve multiword names and input order',()=>{
 assert.deepEqual(tools().parseFabricTerms(' LE AURORA, LUMI\r\nWoodstock\tLE AURORA, lumi '),['LE AURORA','LUMI','Woodstock']);
});
