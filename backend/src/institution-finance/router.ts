import { Router, Response } from 'express';
import { Prisma, PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { AuthRequest } from '../middleware/auth';
import { PlanError } from '../controllers/plan-policy';
import { integer, dueDate } from '../platform-finance/policy';

export const tuitionDb = new PrismaClient();
export const institutionFinanceRouter = Router();
const wrap = (fn: (req: AuthRequest, res: Response) => Promise<unknown>) => (req: AuthRequest, res: Response) => {
  Promise.resolve(fn(req, res)).catch((err: unknown) => {
    if (err instanceof PlanError) return res.status(err.status).json({ error: err.message });
    if ((err as {code?: string})?.code === 'P2002') return res.status(409).json({ error: 'Já existe uma fatura para este aluno e competência, inclusive se cancelada.' });
    return res.status(503).json({ error: 'Não foi possível concluir a operação. Atualize a lista antes de tentar novamente.' });
  });
};
async function actor(db: Prisma.TransactionClient, req: AuthRequest, lock = false, student = false) {
  if (!req.user?.id) throw new PlanError(401, 'Entre novamente.');
  if (lock) await db.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${req.user.id} FOR UPDATE`;
  const user = await db.user.findUnique({ where: { id: req.user.id }, select: { id: true, nome: true, tenantId: true, role: true, permissions: true, disabledAt: true, tenant: {select: {ativo: true}} } });
  if (!user || user.disabledAt || !user.tenantId || !user.tenant?.ativo) throw new PlanError(403, 'Conta ou instituição indisponível.');
  if (student ? user.role !== 'aluno' : !(user.role === 'coord' || (user.role === 'staff' && user.permissions.includes('finance.manage')))) throw new PlanError(403, 'Seu perfil não tem acesso a este financeiro.');
  if (lock) {
    await db.$queryRaw`SELECT "id" FROM "Tenant" WHERE "id" = ${user.tenantId} FOR UPDATE`;
    const tenant = await db.tenant.findUnique({ where: {id:user.tenantId}, select:{ativo:true} });
    if (!tenant?.ativo) throw new PlanError(403, 'Instituição desativada.');
  }
  return {...user, tenantId:user.tenantId};
}
function cursorValue(req: AuthRequest) {
  const cursor = req.query.cursor;
  if (cursor !== undefined && (typeof cursor !== 'string' || !cursor || cursor.length > 160)) throw new PlanError(400, 'Cursor inválido.');
  return cursor as string | undefined;
}
const events = { orderBy: {createdAt:'asc' as const} };
async function studentPage(tenantId: string, cursor?: string) {
  const users = await tuitionDb.user.findMany({where:{tenantId,role:'aluno',disabledAt:null,...(cursor?{id:{gt:cursor}}:{})},select:{id:true,nome:true,email:true,courseId:true,course:{select:{nome:true,tenantId:true}}},orderBy:{id:'asc'},take:101});
  const adjustments = await tuitionDb.tuitionAdjustment.findMany({where:{tenantId,studentId:{in:users.slice(0,100).map(u=>u.id)}}});
  const settings = await tuitionDb.tuitionSettings.findUnique({where:{tenantId},select:{startMonth:true}});
  return {students:users.slice(0,100).map(user=> {const adjustment=adjustments.find(a=>a.studentId===user.id);return {id:user.id,nome:user.nome,email:user.email,courseId:user.course?.tenantId===tenantId?user.courseId:null,courseName:user.course?.tenantId===tenantId?user.course.nome:null,discountCents:adjustment?.discountCents??0,scholarship:adjustment?.scholarship??false,startMonth:adjustment?.startMonth??settings?.startMonth??''};}),studentsNextCursor:users.length>100?users[99].id:null};
}
institutionFinanceRouter.get('/', wrap(async(req,res)=> {
  const user=await actor(tuitionDb,req);const cursor=cursorValue(req);
  const [settings,courses,invoices,students] = await Promise.all([
    tuitionDb.tuitionSettings.findUnique({where:{tenantId:user.tenantId}}),
    tuitionDb.course.findMany({where:{tenantId:user.tenantId},select:{id:true,nome:true},orderBy:{nome:'asc'}}),
    tuitionDb.tuitionInvoice.findMany({where:{tenantId:user.tenantId,...(cursor?{id:{lt:cursor}}:{})},include:{events},orderBy:{id:'desc'},take:101}),studentPage(user.tenantId)
  ]);
  const prices=(settings?.coursePrices??[]) as {courseId:string;priceCents:number}[];
  res.json({settings,courses:courses.map(c=>({...c,priceCents:prices.find(p=>p.courseId===c.id)?.priceCents??null})),...students,invoices:invoices.slice(0,100),nextCursor:invoices.length>100?invoices[99].id:null});
}));
institutionFinanceRouter.get('/students',wrap(async(req,res)=>{const user=await actor(tuitionDb,req);res.json(await studentPage(user.tenantId,cursorValue(req)));}));
institutionFinanceRouter.get('/my-invoices',wrap(async(req,res)=>{
  const user=await actor(tuitionDb,req,false,true);const cursor=cursorValue(req);
  const invoices=await tuitionDb.tuitionInvoice.findMany({where:{tenantId:user.tenantId,studentId:user.id,...(cursor?{id:{lt:cursor}}:{})},include:{events},orderBy:{id:'desc'},take:101});
  // Internal manual-payment notes and operator names are only visible to managers.
  res.json({invoices:invoices.slice(0,100).map(({events:_events,...invoice})=>({...invoice,events:[]})),nextCursor:invoices.length>100?invoices[99].id:null});
}));
institutionFinanceRouter.put('/settings',wrap(async(req,res)=>{
  await actor(tuitionDb,req);const body=req.body??{};
  if (!['SCHOOL','COURSE'].includes(body.mode)) throw new PlanError(400,'Escolha mensalidade da escola ou por curso.');
  integer(body.schoolCents,'Mensalidade',0);integer(body.dueDay,'Vencimento',1,28);dueDate(body.startMonth,body.dueDay);
  if (body.expectedVersion!==null) integer(body.expectedVersion,'Versão');
  const labels:Record<string,string>={issuerName:'o nome do emitente',issuerDocument:'o documento do emitente',issuerAddress:'o endereço do emitente',paymentInstructions:'as instruções de pagamento'};
  const text=(key:string,max:number,required=true)=>{if(typeof body[key]!=='string'||body[key].trim().length>max||(required&&!body[key].trim()))throw new PlanError(400,`Preencha ${labels[key]} corretamente (até ${max} caracteres).`);return body[key].trim() as string;};
  const issuerName=text('issuerName',180),issuerDocument=text('issuerDocument',60),issuerAddress=text('issuerAddress',500),paymentInstructions=text('paymentInstructions',2000,false);
  if (!Array.isArray(body.coursePrices)||body.coursePrices.length>5000)throw new PlanError(400,'Lista de valores por curso inválida.');
  const prices=body.coursePrices.map((p:{courseId:unknown;priceCents:unknown})=>{if(!p||typeof p.courseId!=='string'||!p.courseId||p.courseId.length>160)throw new PlanError(400,'Curso inválido.');return {courseId:p.courseId,priceCents:integer(p.priceCents,'Mensalidade do curso',0)};});
  if(new Set(prices.map((p:{courseId:string})=>p.courseId)).size!==prices.length)throw new PlanError(400,'Curso repetido.');
  const settings=await tuitionDb.$transaction(async tx=>{
    const user=await actor(tx,req,true);const current=await tx.tuitionSettings.findUnique({where:{tenantId:user.tenantId}});
    if((current?.version??null)!==body.expectedVersion)throw new PlanError(409,'A configuração mudou. Atualize antes de salvar.');
    if(await tx.course.count({where:{tenantId:user.tenantId,id:{in:prices.map((p:{courseId:string})=>p.courseId)}}})!==prices.length)throw new PlanError(400,'Um curso não pertence a esta instituição.');
    const data={mode:body.mode as string,schoolCents:body.schoolCents as number,dueDay:body.dueDay as number,startMonth:body.startMonth as string,issuerName,issuerDocument,issuerAddress,paymentInstructions,coursePrices:prices,updatedBy:user.id};
    return current?tx.tuitionSettings.update({where:{tenantId:user.tenantId},data:{...data,version:{increment:1}}}):tx.tuitionSettings.create({data:{...data,tenantId:user.tenantId}});
  });res.json({settings});
}));
institutionFinanceRouter.put('/students/:id',wrap(async(req,res)=>{
  await actor(tuitionDb,req);const {discountCents,startMonth,expectedSettingsVersion,scholarship=false}=req.body??{};
  integer(discountCents,'Desconto');integer(expectedSettingsVersion,'Versão');dueDate(startMonth,1);
  if(typeof scholarship!=='boolean')throw new PlanError(400,'Bolsa inválida.');
  const result=await tuitionDb.$transaction(async tx=>{
    const user=await actor(tx,req,true);const settings=await tx.tuitionSettings.findUnique({where:{tenantId:user.tenantId}});
    if(!settings||settings.version!==expectedSettingsVersion)throw new PlanError(409,'Configure as mensalidades ou atualize a tela.');
    const student=await tx.user.findFirst({where:{id:req.params.id,tenantId:user.tenantId,role:'aluno',disabledAt:null},select:{id:true}});
    if(!student)throw new PlanError(404,'Aluno ativo não encontrado nesta instituição.');
    const data={discountCents,startMonth,scholarship,updatedBy:user.id};
    const adjustment=await tx.tuitionAdjustment.upsert({where:{tenantId_studentId:{tenantId:user.tenantId,studentId:student.id}},create:{...data,tenantId:user.tenantId,studentId:student.id},update:data});
    const updated=await tx.tuitionSettings.update({where:{tenantId:user.tenantId},data:{version:{increment:1},updatedBy:user.id}});
    return {adjustment,settingsVersion:updated.version};
  });res.json(result);
}));
institutionFinanceRouter.post('/invoices',wrap(async(req,res)=>{
  await actor(tuitionDb,req);const {studentId,competence,expectedSettingsVersion}=req.body??{};
  if(typeof studentId!=='string'||!studentId||studentId.length>160)throw new PlanError(400,'Aluno inválido.');integer(expectedSettingsVersion,'Versão');dueDate(competence,1);
  const invoice=await tuitionDb.$transaction(async tx=>{
    const user=await actor(tx,req,true);const settings=await tx.tuitionSettings.findUnique({where:{tenantId:user.tenantId}});
    if(!settings||settings.version!==expectedSettingsVersion)throw new PlanError(409,'Configure as mensalidades ou atualize a tela.');
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${studentId} AND "tenantId" = ${user.tenantId} AND "role" = 'aluno' FOR UPDATE`;
    const student=await tx.user.findFirst({where:{id:studentId,tenantId:user.tenantId,role:'aluno',disabledAt:null},select:{id:true,nome:true,email:true,courseId:true,course:{select:{nome:true,tenantId:true}}}});
    if(!student)throw new PlanError(404,'Aluno ativo não encontrado nesta instituição.');
    const adjustment=await tx.tuitionAdjustment.findUnique({where:{tenantId_studentId:{tenantId:user.tenantId,studentId}}});
    if(competence<settings.startMonth||competence<(adjustment?.startMonth??settings.startMonth))throw new PlanError(400,'Competência anterior ao início da cobrança.');
    const prices=settings.coursePrices as {courseId:string;priceCents:number}[];
    const price=settings.mode==='SCHOOL'?settings.schoolCents:student.course?.tenantId===user.tenantId?prices.find(p=>p.courseId===student.courseId)?.priceCents:undefined;
    if(price===undefined)throw new PlanError(409,'Cadastre a mensalidade do curso deste aluno antes de emitir.');
    const grossCents=integer(price,'Mensalidade'),discountCents=adjustment?.scholarship?grossCents:Math.min(grossCents,adjustment?.discountCents??0),totalCents=grossCents-discountCents;
    if(await tx.tuitionInvoice.findUnique({where:{tenantId_studentId_competence:{tenantId:user.tenantId,studentId,competence}}}))throw new PlanError(409,'Já existe uma fatura para este aluno e competência, inclusive se cancelada.');
    const {issuerName,issuerDocument,issuerAddress,paymentInstructions}=settings;
    return tx.tuitionInvoice.create({data:{tenantId:user.tenantId,studentId,studentName:student.nome,studentEmail:student.email,courseId:student.course?.tenantId===user.tenantId?student.courseId:null,courseName:student.course?.tenantId===user.tenantId?student.course.nome:null,mode:settings.mode,competence,dueDate:dueDate(competence,settings.dueDay),number:`MEN-${competence.replace('-','')}-${randomUUID().toUpperCase()}`,grossCents,discountCents,totalCents,status:totalCents===0?'EXEMPT':'OPEN',issuerName,issuerDocument,issuerAddress,paymentInstructions,settingsVersion:settings.version,events:{create:{actorId:user.id,actorName:user.nome,action:'CREATED',note:totalCents===0?'Isenção registrada, sem pagamento.':'Fatura interna emitida, sem registro bancário ou envio automático.'}}},include:{events}});
  });res.status(201).json({invoice});
}));
institutionFinanceRouter.patch('/invoices/:id/status',wrap(async(req,res)=>{
  await actor(tuitionDb,req);const {status,note,expectedVersion}=req.body??{};integer(expectedVersion,'Versão');
  if(!['PAID','CANCELLED'].includes(status)||typeof note!=='string'||note.trim().length<3||note.trim().length>1000)throw new PlanError(400,'Informe uma justificativa ou referência de pagamento (3 a 1000 caracteres).');
  const invoice=await tuitionDb.$transaction(async tx=>{
    const user=await actor(tx,req,true);const current=await tx.tuitionInvoice.findFirst({where:{id:req.params.id,tenantId:user.tenantId}});
    if(!current)throw new PlanError(404,'Fatura não encontrada.');
    if(current.version!==expectedVersion||!(current.status==='OPEN'||(current.status==='EXEMPT'&&status==='CANCELLED')))throw new PlanError(409,'A fatura já foi alterada ou encerrada. Atualize a lista.');
    return tx.tuitionInvoice.update({where:{id:current.id},data:{status,paidAt:status==='PAID'?new Date():null,version:{increment:1},events:{create:{actorId:user.id,actorName:user.nome,action:status,note:note.trim()}}},include:{events}});
  });res.json({invoice});
}));
