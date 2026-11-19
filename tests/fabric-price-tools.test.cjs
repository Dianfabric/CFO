const {test}=require('node:test'); const assert=require('node:assert/strict');
const ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpile(require('fs').readFileSync(f,'utf8'),{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}),f);
const tools=()=>require('../src/lib/fabric-price-tools.ts');
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
