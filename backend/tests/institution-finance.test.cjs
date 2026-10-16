const test = require('node:test');
const assert = require('node:assert/strict');
const { institutionFinanceRouter: router, tuitionDb: db } = require('../dist/institution-finance/router');
let actor, settings, adjustment, student, currentInvoice, created, saved;
function reset(role = 'coord') {
  actor={id:'manager',nome:'Manager',role,permissions:[],tenantId:'tenant',tenant:{ativo:true},disabledAt:null};
  settings={tenantId:'tenant',mode:'SCHOOL',schoolCents:10000,dueDay:10,startMonth:'2026-10',issuerName:'School',issuerDocument:'123',issuerAddress:'Address',paymentInstructions:'Pay at office',version:1,coursePrices:[{courseId:'medicine',priceCents:500000}]};
  student={id:'student',nome:'Student',email:'student@example.invalid',courseId:'medicine',course:{nome:'Medicine',tenantId:'tenant'}};
  adjustment=null;currentInvoice=null;created=null;saved=null;
  db.$transaction=async fn=>fn(db);db.$queryRaw=async()=>[];
  db.user.findUnique=async()=>actor;db.user.findFirst=async args=>args.where.tenantId==='tenant'?student:null;
  db.tenant.findUnique=async()=>({ativo:true});
  db.tuitionSettings.findUnique=async()=>settings;
  db.tuitionSettings.update=async args=>(saved=args.data,{...settings,version:settings.version+1});
  db.tuitionSettings.create=async args=>(saved=args.data,args.data);
  db.tuitionAdjustment.findUnique=async()=>adjustment;
  db.tuitionAdjustment.upsert=async args=>args.create;
  db.tuitionInvoice.findUnique=async()=>currentInvoice;
  db.tuitionInvoice.findFirst=async args=>currentInvoice?.tenantId===args.where.tenantId?currentInvoice:null;
  db.tuitionInvoice.create=async args=>(created=args.data,{id:'invoice',...args.data});
  db.tuitionInvoice.update=async args=>(saved=args.data,{...currentInvoice,...args.data});
  db.course.count=async args=>args.where.id.in.every(id=>id==='medicine')?args.where.id.in.length:0;
}
function request(path,method='GET',body={},query={}) {
  return new Promise((resolve,reject)=>{
    const layer=router.stack.find(item=>item.route&&item.route.methods[method.toLowerCase()]&&item.match(path));assert.ok(layer);
    const req={user:{id:'manager',role:'superadmin',tenantId:'forged'},params:layer.params,body,query};
    const res={code:200,status(code){this.code=code;return this;},json(value){resolve({code:this.code,body:value});return this;}};
    Promise.resolve(layer.route.stack[0].handle(req,res,()=>{})).catch(reject);
  });
}
const issue=()=>request('/invoices','POST',{studentId:'student',competence:'2026-10',expectedSettingsVersion:1});
test('institution finance trusts current DB role, rejects professor superadmin and revoked staff grants',async()=>{
  for(const role of ['professor','superadmin','aluno','staff']){reset(role);assert.equal((await issue()).code,403);}
  reset('staff');actor.permissions=['finance.manage'];assert.equal((await issue()).code,201);
  actor.disabledAt=new Date();assert.equal((await issue()).code,403);
  reset();actor.tenant.ativo=false;assert.equal((await issue()).code,403);
});
test('school and course monthly fees are independent and immutable snapshots',async()=>{
  reset();assert.equal((await issue()).code,201);assert.equal(created.totalCents,10000);assert.equal(created.mode,'SCHOOL');
  assert.equal(created.tenantId,'tenant');assert.equal(created.issuerName,'School');assert.equal(created.studentName,'Student');
  reset();settings.mode='COURSE';assert.equal((await issue()).code,201);assert.equal(created.grossCents,500000);
  assert.equal(created.settingsVersion,1);assert.equal(created.events.create.action,'CREATED');
});
test('course price is required and foreign course cannot be used for billing',async()=>{
  reset();settings.mode='COURSE';settings.coursePrices=[];assert.equal((await issue()).code,409);assert.equal(created,null);
  reset();settings.mode='COURSE';student.course.tenantId='other';assert.equal((await issue()).code,409);
});
test('discount caps at gross, scholarships yield EXEMPT without payment claims',async()=>{
  reset();adjustment={discountCents:2000,startMonth:'2026-10',scholarship:false};await issue();assert.equal(created.totalCents,8000);
  adjustment.discountCents=99999;await issue();assert.equal(created.discountCents,10000);assert.equal(created.status,'EXEMPT');assert.equal(created.paidAt,undefined);
  adjustment={discountCents:0,startMonth:'2026-10',scholarship:true};await issue();assert.equal(created.totalCents,0);assert.equal(created.status,'EXEMPT');
});
test('issuance rejects pre-start stale and duplicate including cancelled invoices',async()=>{
  reset();settings.startMonth='2026-11';assert.equal((await issue()).code,400);
  reset();adjustment={discountCents:0,startMonth:'2026-11'};assert.equal((await issue()).code,400);
  reset();settings.version=2;assert.equal((await issue()).code,409);
  reset();currentInvoice={status:'CANCELLED'};assert.equal((await issue()).code,409);assert.equal(created,null);
  reset();student=null;assert.equal((await issue()).code,404);
});
test('settings reject foreign courses duplicate prices and stale version',async()=>{
  reset();const body={...settings,expectedVersion:1,coursePrices:[{courseId:'foreign',priceCents:99}]};
  assert.equal((await request('/settings','PUT',body)).code,400);
  body.coursePrices=[{courseId:'medicine',priceCents:10},{courseId:'medicine',priceCents:20}];assert.equal((await request('/settings','PUT',body)).code,400);
  body.coursePrices=[];body.expectedVersion=0;assert.equal((await request('/settings','PUT',body)).code,409);
  body.expectedVersion=1;assert.equal((await request('/settings','PUT',body)).code,200);assert.deepEqual(saved.version,{increment:1});
});
test('student adjustment increments settings version and does not alter invoices',async()=>{
  reset();assert.equal((await request('/students/student','PUT',{discountCents:500,scholarship:false,startMonth:'2026-10',expectedSettingsVersion:1})).code,200);
  assert.deepEqual(saved.version,{increment:1});assert.equal(created,null);
  settings.version=2;assert.equal((await request('/students/student','PUT',{discountCents:500,startMonth:'2026-10',expectedSettingsVersion:1})).code,409);
});
test('manual settlement requires note version tenant match and never overwrites amounts',async()=>{
  reset();currentInvoice={id:'invoice',tenantId:'tenant',status:'OPEN',version:0,totalCents:10000};
  const payload={status:'PAID',note:'Cash desk receipt 7',expectedVersion:0,totalCents:1};
  assert.equal((await request('/invoices/invoice/status','PATCH',payload)).code,200);assert.equal(saved.totalCents,undefined);assert.ok(saved.paidAt instanceof Date);assert.equal(saved.events.create.actorId,'manager');
  currentInvoice.status='PAID';assert.equal((await request('/invoices/invoice/status','PATCH',payload)).code,409);
  currentInvoice.status='OPEN';currentInvoice.tenantId='other';assert.equal((await request('/invoices/invoice/status','PATCH',payload)).code,404);
  currentInvoice.tenantId='tenant';payload.note='';assert.equal((await request('/invoices/invoice/status','PATCH',payload)).code,400);
});
test('student invoices strictly own tenant and account, suppress internal operator notes',async()=>{
  reset('aluno');db.tuitionInvoice.findMany=async args=>{assert.equal(args.where.studentId,'manager');assert.equal(args.where.tenantId,'tenant');return [{id:'invoice',totalCents:100,events:[{note:'Internal sensitive note',actorName:'Manager'}]}];};
  const result=await request('/my-invoices');assert.equal(result.code,200);assert.deepEqual(result.body.invoices[0].events,[]);
  assert.equal((await request('/my-invoices','GET',{}, {cursor:['bad']})).code,400);
});
