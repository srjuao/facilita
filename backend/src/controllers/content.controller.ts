import { PrismaClient } from '@prisma/client';
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { signedLesson } from './media-access';
const prisma = new PrismaClient();

// Re-read assignments so stale JWTs cannot publish in a formerly assigned course.
const assignedCourse = async (req: AuthRequest) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, include: { tenant: true, course: true } });
  return user && ['coord', 'professor'].includes(user.role) && user.tenant?.ativo && (user.role === 'coord' || (user.permissions.includes('content.manage') && user.course?.tenantId === user.tenantId)) ? user : null;
};
export const createModule = async (req: AuthRequest, res: Response) => {
  try {
    const user = await assignedCourse(req);
    if (!user) return res.status(403).json({ error: 'A coordenação não liberou a gestão de conteúdo para sua conta.' });
    const courseId = typeof req.body.courseId === 'string' ? req.body.courseId : user.courseId;
    const course = courseId && await prisma.course.findFirst({ where: { id: courseId, tenantId: user.tenantId!, ...(user.role === 'professor' ? { id: user.courseId || '' } : {}) } });
    if (!course) return res.status(404).json({ error: 'Curso não encontrado na sua unidade.' });
    const periodId = typeof req.body.periodId === 'string' && req.body.periodId ? req.body.periodId : null;
    if (periodId && !await prisma.academicPeriod.findFirst({ where: { id: periodId, tenantId: user.tenantId!, courseId: course.id } })) return res.status(400).json({ error: 'Período inválido para este curso.' });
    const nome = typeof req.body.nome === 'string' ? req.body.nome.trim() : '';
    if (!nome || nome.length > 120) return res.status(400).json({ error: 'Informe o nome da matéria, com até 120 caracteres.' });
    const module = await prisma.module.create({ data: { id: `module_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, nome, desc: '', img: '', color: '#2f7dd1', aulas: 0, lista: '[]', courseId: course.id, periodId } });
    return res.status(201).json(module);
  } catch { return res.status(500).json({ error: 'Não foi possível cadastrar a matéria.' }); }
};
export const createLesson = async (req: AuthRequest, res: Response) => {
  try {
    const user = await assignedCourse(req);
    if (!user) return res.status(403).json({ error: 'A coordenação não liberou a gestão de conteúdo para sua conta.' });
    const module = await prisma.module.findFirst({ where: { id: req.params.id, course: { tenantId: user.tenantId! }, ...(user.role === 'professor' ? { courseId: user.courseId || '' } : {}) } });
    if (!module) return res.status(404).json({ error: 'Matéria não encontrada neste curso.' });
    const { titulo, videoUrl } = req.body;
    if (typeof titulo !== 'string' || !titulo.trim() || titulo.length > 200 || typeof videoUrl !== 'string' || !(/^https:\/\//.test(videoUrl) || /^\/(?:api\/)?uploads\/videos\/[\w.-]+$/.test(videoUrl))) return res.status(400).json({ error: 'Informe o título e envie um vídeo ou uma URL HTTPS válida.' });
    const lesson = await prisma.$transaction(async tx => {
      const created = await tx.lesson.create({ data: { titulo: titulo.trim(), videoUrl, moduleId: module.id, prof: user.nome, duracao: '', desc: '' } });
      await tx.module.update({ where: { id: module.id }, data: { aulas: { increment: 1 } } });
      await tx.course.update({ where: { id: module.courseId }, data: { aulas: { increment: 1 } } });
      return created;
    });
    return res.status(201).json(signedLesson(lesson, user.id));
  } catch { return res.status(500).json({ error: 'Não foi possível salvar a aula.' }); }
};
