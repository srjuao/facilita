import { Router, Response } from 'express';
import { randomUUID } from 'crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { currentAccess } from '../controllers/plan-access';
import { assertCourseContentAccess } from '../commerce/access';
import { PlanError } from '../controllers/plan-policy';

const db = new PrismaClient();
export const certificateRouter = Router();
type Tx = Prisma.TransactionClient;
const route = (handler: (req: AuthRequest, res: Response) => Promise<unknown>) => (req: AuthRequest, res: Response) => Promise.resolve(handler(req, res)).catch(error => {
  if (error instanceof PlanError) return res.status(error.status).json({ error: error.message });
  return res.status(503).json({ error: 'Não foi possível processar o certificado.' });
});
const field = (value: unknown, max: number) => typeof value === 'string' && value.trim() && value.trim().length <= max ? value.trim() : null;
const validScope = (value: unknown): value is 'module' | 'course' => value === 'module' || value === 'course';
const certificateTarget = async (tx: Tx, scope: string, targetId: string) => {
  if (scope === 'module') {
    const module = await tx.module.findFirst({ where: { id: targetId, archivedAt: null, OR: [{ periodId: null }, { period: { archivedAt: null } }] }, include: { course: true } });
    return module ? { tenantId: module.course.tenantId, course: module.course, title: module.nome, moduleId: module.id } : null;
  }
  const course = await tx.course.findUnique({ where: { id: targetId } });
  return course ? { tenantId: course.tenantId, course, title: course.nome, moduleId: null } : null;
};
async function authorizeEditor(tx: Tx, userId: string, courseId: string) {
  const [user, course] = await Promise.all([
    tx.user.findUnique({ where: { id: userId }, include: { tenant: true } }),
    tx.course.findUnique({ where: { id: courseId } })
  ]);
  if (!user || user.disabledAt || !user.tenant?.ativo || !course || user.tenantId !== course.tenantId || !(user.role === 'coord' || user.role === 'professor' && user.courseId === course.id && user.permissions.includes('content.manage'))) throw new PlanError(403, 'Sem permissão para configurar certificados deste curso.');
}
async function lessonsDone(tx: Tx, userId: string, moduleId: string) {
  const [total, done] = await Promise.all([
    tx.lesson.count({ where: { moduleId, archivedAt: null } }),
    tx.lessonCompletion.count({ where: { userId, lesson: { moduleId, archivedAt: null } } })
  ]);
  return total > 0 && done === total;
}
async function eligible(tx: Tx, userId: string, scope: string, targetId: string) {
  const modules = scope === 'module'
    ? await tx.module.findMany({ where: { id: targetId, archivedAt: null } })
    : await tx.module.findMany({ where: { courseId: targetId, archivedAt: null, OR: [{ periodId: null }, { period: { archivedAt: null } }] } });
  if (!modules.length) return false;
  for (const module of modules) {
    if (!await lessonsDone(tx, userId, module.id)) return false;
    if (module.finalExamId) {
      const exam = await tx.exam.findUnique({ where: { id: module.finalExamId } });
      if (!exam?.published || exam.archivedAt || !await tx.examAttempt.findFirst({ where: { examId: exam.id, userId, passed: true } })) return false;
    }
  }
  return true;
}
const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] || character);

certificateRouter.get('/templates', route(async (req, res) => {
  const user = await currentAccess(req);
  const courseId = typeof req.query.courseId === 'string' ? req.query.courseId : user.courseId;
  if (!courseId) throw new PlanError(400, 'Selecione um curso.');
  await db.$transaction(tx => authorizeEditor(tx, user.id, courseId));
  res.json({ templates: await db.certificateTemplate.findMany({ where: { tenantId: user.tenantId!, OR: [{ scope: 'course', targetId: courseId }, { scope: 'module', targetId: { in: (await db.module.findMany({ where: { courseId }, select: { id: true } })).map(item => item.id) } }] }, orderBy: { updatedAt: 'desc' } }) });
}));

certificateRouter.put('/templates/:scope/:targetId', route(async (req, res) => {
  if (!validScope(req.params.scope)) throw new PlanError(400, 'Tipo de certificado inválido.');
  const body = req.body ?? {};
  const title = field(body.title, 180), issuer = field(body.issuer, 180), signatory = field(body.signatory, 120), signatoryRole = field(body.signatoryRole, 120);
  if (!title || !issuer || !signatory || !signatoryRole || !Number.isSafeInteger(body.workloadHours) || body.workloadHours < 1 || body.workloadHours > 10000 || typeof body.enabled !== 'boolean') throw new PlanError(400, 'Informe título, emissor, assinatura, carga horária e situação válidos.');
  const user = await currentAccess(req);
  const template = await db.$transaction(async tx => {
    const target = await certificateTarget(tx, req.params.scope, req.params.targetId);
    if (!target) throw new PlanError(404, 'Curso ou matéria não encontrado.');
    await authorizeEditor(tx, user.id, target.course.id);
    return tx.certificateTemplate.upsert({ where: { tenantId_scope_targetId: { tenantId: target.tenantId, scope: req.params.scope, targetId: req.params.targetId } },
      create: { tenantId: target.tenantId, scope: req.params.scope, targetId: req.params.targetId, title, issuer, signatory, signatoryRole, workloadHours: body.workloadHours, enabled: body.enabled },
      update: { title, issuer, signatory, signatoryRole, workloadHours: body.workloadHours, enabled: body.enabled } });
  });
  res.json({ template });
}));

certificateRouter.post('/issue', route(async (req, res) => {
  const { scope, targetId } = req.body ?? {};
  if (!validScope(scope) || typeof targetId !== 'string' || targetId.length > 160) throw new PlanError(400, 'Selecione curso ou matéria.');
  const user = await currentAccess(req);
  if (user.role !== 'aluno' || !user.tenantId) throw new PlanError(403, 'Somente alunos podem emitir certificados.');
  const issue = await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${user.id} FOR UPDATE`;
    const target = await certificateTarget(tx, scope, targetId);
    if (!target || target.tenantId !== user.tenantId) throw new PlanError(404, 'Curso ou matéria não encontrado.');
    await assertCourseContentAccess(user, target.course);
    const template = await tx.certificateTemplate.findUnique({ where: { tenantId_scope_targetId: { tenantId: target.tenantId, scope, targetId } } });
    if (!template?.enabled) throw new PlanError(404, 'Certificado não disponível para este conteúdo.');
    const existing = await tx.certificateIssue.findUnique({ where: { userId_scope_targetId: { userId: user.id, scope, targetId } } });
    if (existing) return existing;
    if (!await eligible(tx, user.id, scope, targetId)) throw new PlanError(403, 'Conclua todas as aulas e a avaliação final para emitir o certificado.');
    const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: target.tenantId } });
    const snapshot = { studentName: user.nome, contentTitle: target.title, tenantName: tenant.nome, tenantFull: tenant.full, logoUrl: tenant.logoUrl, accentColor: tenant.primaryColor,
      title: template.title, issuer: template.issuer, signatory: template.signatory, signatoryRole: template.signatoryRole, workloadHours: template.workloadHours };
    return tx.certificateIssue.create({ data: { code: randomUUID(), templateId: template.id, tenantId: target.tenantId, userId: user.id, scope, targetId, snapshot } });
  });
  res.status(201).json({ certificate: { code: issue.code, scope: issue.scope, targetId: issue.targetId, issuedAt: issue.issuedAt, snapshot: issue.snapshot, downloadUrl: `/api/certificates/${issue.code}/download` } });
}));

certificateRouter.get('/mine', route(async (req, res) => {
  const user = await currentAccess(req);
  if (user.role !== 'aluno') throw new PlanError(403, 'Apenas alunos podem consultar seus certificados.');
  const issues = await db.certificateIssue.findMany({ where: { userId: user.id }, orderBy: { issuedAt: 'desc' } });
  res.json({ certificates: issues.map(issue => ({ code: issue.code, scope: issue.scope, targetId: issue.targetId, issuedAt: issue.issuedAt, snapshot: issue.snapshot, downloadUrl: `/api/certificates/${issue.code}/download` })) });
}));

certificateRouter.get('/:code/download', route(async (req, res) => {
  const user = await currentAccess(req);
  const issue = await db.certificateIssue.findUnique({ where: { code: req.params.code } });
  if (!issue || issue.userId !== user.id && user.role !== 'superadmin' && !(user.role === 'coord' && user.tenantId === issue.tenantId)) throw new PlanError(404, 'Certificado não encontrado.');
  const data = issue.snapshot as Record<string, unknown>;
  const html = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Certificado ${escape(issue.code)}</title><style>@page{size:A4 landscape;margin:15mm}body{font-family:Georgia,serif;background:#f5f3ec;color:#172339;margin:0}.sheet{border:10px double ${/^#[0-9a-fA-F]{6}$/.test(String(data.accentColor)) ? data.accentColor : '#245689'};padding:35px;min-height:420px;text-align:center;background:white}h1{font-size:42px;margin:25px 0}p{font-size:22px;line-height:1.5}.small{font:14px Arial,sans-serif;color:#526078}.sign{margin:48px auto 12px;width:300px;border-top:1px solid #172339;padding-top:8px}</style><div class="sheet"><div class="small">${escape(data.tenantFull || data.tenantName)}</div><h1>${escape(data.title)}</h1><p>Certificamos que <strong>${escape(data.studentName)}</strong> concluiu ${issue.scope === 'module' ? 'a matéria' : 'o curso'} <strong>${escape(data.contentTitle)}</strong>, com carga horária de ${escape(data.workloadHours)} horas.</p><div class="sign">${escape(data.signatory)}<br><span class="small">${escape(data.signatoryRole)} · ${escape(data.issuer)}</span></div><div class="small">Emitido em ${new Date(issue.issuedAt).toLocaleDateString('pt-BR')} · Código de verificação ${escape(issue.code)}</div></div></html>`;
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="certificado-${issue.code}.html"`);
  res.send(html);
}));

export async function verifyCertificate(req: AuthRequest, res: Response) {
  const issue = typeof req.params.code === 'string' && /^[a-f0-9-]{36}$/.test(req.params.code) ? await db.certificateIssue.findUnique({ where: { code: req.params.code } }) : null;
  if (!issue) return res.status(404).json({ valid: false });
  const snapshot = issue.snapshot as Record<string, unknown>;
  return res.json({ valid: true, code: issue.code, issuedAt: issue.issuedAt, scope: issue.scope, studentName: snapshot.studentName, contentTitle: snapshot.contentTitle, tenantName: snapshot.tenantName, workloadHours: snapshot.workloadHours });
}
