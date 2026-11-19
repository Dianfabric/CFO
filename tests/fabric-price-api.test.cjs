const {test}=require('node:test');const assert=require('node:assert/strict');const ts=require('typescript'),Module=require('module');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpile(require('fs').readFileSync(f,'utf8'),{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}),f);
const calls=[];const original=Module._load;
Module._load=function(name,...args){if(name==='@/lib/prisma')return {prisma:{$queryRawUnsafe:async(sql,...values)=>{calls.push({sql,values});if(sql.includes('information_schema'))return ['id','product_name','search_alias','product_name_ko','brand','brand_code','is_active','sell_price','dealer_price'].map(column_name=>({column_name}));if(sql.includes('AS "term_0"'))return [{term_0:2,term_1:0}];if(sql.includes('AS total'))return [{total:202}];return []}}};if(name==='@/lib/fabric-price-tools')return require('../src/lib/fabric-price-tools.ts');return original.call(this,name,...args)};
test('multi search metadata computed before pagination, bound parameters and stable ID ordering',async()=>{
 const {queryFabricList}=require('../src/lib/fabric-knowledge.ts');
 const result=await queryFabricList({multiQuery:'LUMI,missing',page:2,brand:'EK'});
 assert.deepEqual(result.missingTerms,['missing']);
 const count=calls.find(c=>c.sql.includes('AS "term_0"'));assert.ok(count);assert.ok(!count.sql.includes('LIMIT'));assert.ok(count.values.includes('%LUMI%'));assert.ok(count.values.includes('EK'));
 const list=calls.find(c=>c.sql.includes('LIMIT'));assert.match(list.sql,/ORDER BY CASE/);assert.match(list.sql,/"id"/);assert.ok(!list.sql.includes('LUMI'));
});
