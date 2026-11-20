// Real PostgreSQL engine, isolated in-memory fixture; never writes production DB.
// PGLITE_MODULE=/tmp/cfo-price-qa/node_modules/@electric-sql/pglite node --test ...
const {test}=require('node:test'),assert=require('node:assert/strict');
const {PGlite}=require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const ts=require('typescript'),Module=require('module'),db=new PGlite();
require.extensions['.ts']=(m,f)=>m._compile(ts.transpile(require('fs').readFileSync(f,'utf8'),{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}),f);
const original=Module._load;
Module._load=function(name,...args){if(name==='@/lib/prisma')return {prisma:{$queryRawUnsafe:async(sql,...values)=>(await db.query(sql,values)).rows}};if(name==='@/lib/fabric-price-tools')return require('../src/lib/fabric-price-tools.ts');return original.call(this,name,...args)};
test('SQL color search exact protection, alias, brand ambiguity, input identity and pagination',async()=>{
 await db.exec(`CREATE TABLE fabric_knowledge_master (id int, product_name text, search_alias text, product_name_ko text,brand text,brand_code text,is_active boolean,sell_price int,dealer_price int);
 INSERT INTO fabric_knowledge_master VALUES
 (1,'KOSHER',null,null,'A','A',true,35000,30000),
 (2,'KOSHER',null,null,'B','B',true,40000,0),
 (3,'MODEL-05',null,null,'A','A',true,null,0),
 (4,'MODEL',null,null,'A','A',true,999,888),
 (5,'SUN-DEW',null,null,'A','A',true,1,2),
 (6,'LD1003B','Woodstock',null,'RICKY','RI',true,3,4);`);
 const {queryFabricList:q}=require('../src/lib/fabric-knowledge.ts');
 const single=await q({query:'kosher-05'});assert.equal(single.rows.length,2);assert.ok(single.rows.every(r=>r.copy_name==='kosher-05'));
 const text='kosher-05,Kosher#007,MODEL-05,SUN-DEW-04,Woodstock#01,missing-09';
 const all=await q({multiQuery:text,pageSize:1000});assert.equal(all.pagination.pageSize,100);assert.equal(all.pagination.total,7);
 assert.deepEqual(all.rows.map(r=>r.id),[1,2,1,2,3,5,6]);assert.deepEqual(all.missingTerms,['missing-09']);
 assert.deepEqual(all.rows.map(r=>r.copy_name),['kosher-05','kosher-05','Kosher#007','Kosher#007','MODEL-05','SUN-DEW-04','Woodstock#01']);
 const pages=[];for(let p=1;p<=4;p++)pages.push(...(await q({multiQuery:text,pageSize:2,page:p})).rows);
 assert.deepEqual(pages,all.rows);
 assert.equal((await q({multiQuery:'kosher-05,kosher-07',brand:'B'})).rows.length,2);
 assert.deepEqual((await q({query:'MODEL-05',brand:'B'})).rows,[]);
 assert.deepEqual((await q({query:'SUN-DEW'})).rows.map(r=>r.id),[5]);
 assert.deepEqual((await q({multiQuery:"x%' OR 1=1 --#05"})).rows,[]);
 await db.close();
});
