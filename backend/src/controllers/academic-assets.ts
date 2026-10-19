import { Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { currentAccess } from './plan-access';
import { assertCourseContentAccess } from '../commerce/access';
import { studentCanAccessLesson } from './learning-path';

const db = new PrismaClient();
const root = path.resolve(__dirname, '../../uploads/academic');
fs.mkdirSync(root, { recursive: true });
const safeName = (name: string) => path.basename(name).replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 160) || 'arquivo';
const coverTypes: Record<string, string> = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' };
const attachmentTypes: Record<string, string> = { 'application/pdf': '.pdf', 'image/png': '.png', 'image/jpeg': '.jpg', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx' };
export const moduleCoverUrl = (moduleId: string, img: string) => /^[a-f0-9-]+\.(png|jpg|webp)$/.test(img) ? `/api/modules/${moduleId}/cover` : img;
const storage = multer.diskStorage({ destination: (_req, _file, cb) => cb(null, root), filename: (_req, file, cb) => cb(null, `${randomUUID()}${coverTypes[file.mimetype] || attachmentTypes[file.mimetype] || ''}`) });
export const coverUpload = multer({ storage, limits: { files: 1, fileSize: 5 * 1024 * 1024 }, fileFilter: (_req, file, cb) => cb(null, !!coverTypes[file.mimetype]) });
export const attachmentUpload = multer({ storage, limits: { files: 1, fileSize: 20 * 1024 * 1024 }, fileFilter: (_req, file, cb) => cb(null, !!attachmentTypes[file.mimetype]) });
async function editor(req: AuthRequest, courseId: string) {
  const user = await db.user.findUnique({ where: { id: req.user?.id || '' }, include: { tenant: true } });
  const course = await db.course.findUnique({ where: { id: courseId } });
  return !!user && !user.disabledAt && !!user.tenant?.ativo && !!course && user.tenantId === course.tenantId && (user.role === 'coord' || user.role === 'professor' && user.courseId === course.id && user.permissions.includes('content.manage'));
}
export async function uploadModuleCover(req: AuthRequest, res: Response) {
  const file = req.file;
  try {
    if (!file) return res.status(400).json({ error: 'Envie uma imagem PNG, JPG ou WebP de até 5 MB.' });
    const module = await db.module.findFirst({ where: { id: req.params.id, archivedAt: null }, include: { course: true } });
    if (!module || !await editor(req, module.courseId)) return res.status(403).json({ error: 'Sem acesso a esta matéria.' });
    const img = `/api/modules/${module.id}/cover`;
    await db.module.update({ where: { id: module.id }, data: { img: file.filename } });
    return res.status(201).json({ img });
  } catch { return res.status(503).json({ error: 'Não foi possível salvar a capa.' }); }
  finally { if (file && res.statusCode !== 201) fs.promises.unlink(file.path).catch(() => undefined); }
}
export async function getModuleCover(req: Request, res: Response) {
  try {
    const module = await db.module.findUnique({ where: { id: req.params.id }, include: { course: { include: { tenant: true } } } });
    if (!module || module.archivedAt || !module.course.tenant.ativo) return res.sendStatus(404);
    if (!/^[a-f0-9-]+\.(png|jpg|webp)$/.test(module.img)) return res.sendStatus(404);
    res.setHeader('Cache-Control', 'private, no-store');
    return res.sendFile(path.join(root, module.img));
  } catch { return res.sendStatus(403); }
}
export async function uploadLessonAttachment(req: AuthRequest, res: Response) {
  const file = req.file;
  try {
    if (!file) return res.status(400).json({ error: 'Envie PDF, DOCX, PNG ou JPG de até 20 MB.' });
    const lesson = await db.lesson.findFirst({ where: { id: req.params.id, archivedAt: null }, include: { module: true } });
    if (!lesson || !await editor(req, lesson.module.courseId)) return res.status(403).json({ error: 'Sem acesso a esta aula.' });
    const attachment = await db.lessonAttachment.create({ data: { lessonId: lesson.id, filename: safeName(file.originalname), storageName: file.filename, mimeType: file.mimetype, size: file.size } });
    return res.status(201).json({ attachment: { id: attachment.id, filename: attachment.filename, mimeType: attachment.mimeType, size: attachment.size, downloadUrl: `/api/lessons/${lesson.id}/attachments/${attachment.id}/download` } });
  } catch { return res.status(503).json({ error: 'Não foi possível anexar o arquivo.' }); }
  finally { if (file && res.statusCode !== 201) fs.promises.unlink(file.path).catch(() => undefined); }
}
export async function createLessonLink(req: AuthRequest, res: Response) {
  try {
    const lesson = await db.lesson.findFirst({ where: { id: req.params.id, archivedAt: null }, include: { module: true } });
    if (!lesson || !await editor(req, lesson.module.courseId)) return res.status(403).json({ error: 'Sem acesso a esta aula.' });
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const rawUrl = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
    if (!title || title.length > 160 || !rawUrl || rawUrl.length > 2048) return res.status(400).json({ error: 'Informe um título e um link válidos.' });
    let url: URL;
    try { url = new URL(rawUrl); } catch { return res.status(400).json({ error: 'Informe um endereço HTTPS válido.' }); }
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) return res.status(400).json({ error: 'O material deve usar um endereço HTTPS válido.' });
    const link = await db.lessonLink.create({ data: { lessonId: lesson.id, title, url: url.href } });
    return res.status(201).json({ link });
  } catch { return res.status(503).json({ error: 'Não foi possível salvar o link.' }); }
}
export async function deleteLessonLink(req: AuthRequest, res: Response) {
  try {
    const link = await db.lessonLink.findFirst({ where: { id: req.params.linkId, lessonId: req.params.id }, include: { lesson: { include: { module: true } } } });
    if (!link) return res.sendStatus(404);
    if (!await editor(req, link.lesson.module.courseId)) return res.sendStatus(403);
    await db.lessonLink.delete({ where: { id: link.id } });
    return res.sendStatus(204);
  } catch { return res.status(503).json({ error: 'Não foi possível remover o link.' }); }
}
export async function downloadLessonAttachment(req: AuthRequest, res: Response) {
  try {
    const account = await currentAccess(req);
    const file = await db.lessonAttachment.findFirst({ where: { id: req.params.attachmentId, lessonId: req.params.id, lesson: { archivedAt: null, module: { archivedAt: null, OR: [{ periodId: null }, { period: { archivedAt: null } }] } } }, include: { lesson: { include: { module: { include: { course: true } } } } } });
    if (!file) return res.sendStatus(404);
    if (account.role !== 'superadmin' && account.tenant?.plan && !account.tenant.plan.videoAulas) return res.status(403).json({ error: 'Conteúdo indisponível no plano atual.' });
    await assertCourseContentAccess(account, file.lesson.module.course);
    if (!await studentCanAccessLesson(file.lessonId, account.id, account.role)) return res.status(403).json({ error: 'Conclua a aula anterior primeiro.' });
    if (!/^[a-f0-9-]+\.(pdf|png|jpg|docx)$/.test(file.storageName)) return res.sendStatus(404);
    res.setHeader('Cache-Control', 'private, no-store');
    return res.download(path.join(root, file.storageName), file.filename);
  } catch { return res.sendStatus(403); }
}
