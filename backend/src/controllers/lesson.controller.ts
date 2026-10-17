import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { currentAccess } from './plan-access';
import { PlanError } from './plan-policy';
import { assertCourseContentAccess, PaidCourseError } from '../commerce/access';
import { learningState, studentCanAccessLesson } from './learning-path';

const prisma = new PrismaClient();

export const getLessonsByModule = async (req: AuthRequest, res: Response) => {
  try {
    const { moduleId } = req.query;
    const account = await currentAccess(req);
    const selectedModule = typeof moduleId === 'string' ? await prisma.module.findFirst({ where: { id: moduleId, archivedAt: null, OR: [{ periodId: null }, { period: { archivedAt: null } }] }, include: { course: true } }) : null;
    if (moduleId && !selectedModule) return res.status(404).json({ error: 'Matéria não encontrada.' });
    if (selectedModule) await assertCourseContentAccess(account, selectedModule.course);
    else if (account.role !== 'superadmin' && account.role !== 'coord') {
      const course = account.courseId ? await prisma.course.findUnique({ where: { id: account.courseId } }) : null;
      if (!course) return res.status(403).json({ error: 'Curso não associado ao usuário.' });
      await assertCourseContentAccess(account, course);
    }
    if (!selectedModule && !['superadmin', 'coord'].includes(req.user?.role || '') && !req.user?.courseId) {
      return res.status(403).json({ error: 'Curso não associado ao usuário.' });
    }
    const lessons = await prisma.lesson.findMany({
      where: {
        archivedAt: null,
        module: { archivedAt: null, OR: [{ periodId: null }, { period: { archivedAt: null } }] },
        ...(moduleId ? { moduleId: String(moduleId) } : {}),
        ...(selectedModule || req.user?.role === 'superadmin' ? {} : req.user?.role === 'coord' ? { module: { archivedAt: null, OR: [{ periodId: null }, { period: { archivedAt: null } }], course: { tenantId: req.user.tenantId } } } : { module: { archivedAt: null, OR: [{ periodId: null }, { period: { archivedAt: null } }], courseId: req.user?.courseId } })
      },
      include: { module: true }
    });
    const states = new Map(await Promise.all([...new Set(lessons.map(lesson => lesson.moduleId))].map(async id => [id, await learningState(id, account.id, account.role)] as const)));
    return res.json(lessons.map(lesson => states.get(lesson.moduleId)!.lessons.find(item => item.id === lesson.id)));
  } catch (error) {
    if (error instanceof PaidCourseError) return res.status(error.status).json({ error: error.message, code: error.code, courseId: error.courseId, priceCents: error.priceCents });
    if (error instanceof PlanError) return res.status(error.status).json({ error: error.message });
    return res.status(500).json({ error: 'Erro ao buscar aulas' });
  }
};

export const getLessonById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const account = await currentAccess(req);
    const lesson = await prisma.lesson.findFirst({
      where: { id, archivedAt: null, module: { archivedAt: null, OR: [{ periodId: null }, { period: { archivedAt: null } }] } },
      include: { module: { include: { course: true, finalExam: { select: { id: true, nome: true, published: true, archivedAt: true } } } } }
    });

    if (!lesson) return res.status(404).json({ error: 'Aula não encontrada' });
    await assertCourseContentAccess(account, lesson.module.course);
    const state = await learningState(lesson.moduleId, account.id, account.role);
    const selected = state.lessons.find(item => item.id === lesson.id);
    if (!selected || selected.locked) return res.status(403).json({ error: 'Conclua a aula anterior para desbloquear esta aula.' });
    return res.json({ ...selected, module: { ...lesson.module, finalExam: account.role === 'aluno' && (!state.complete || !lesson.module.finalExam?.published || lesson.module.finalExam?.archivedAt) ? null : lesson.module.finalExam, lessons: state.lessons, finalExamLocked: account.role === 'aluno' && !state.complete } });
  } catch (error) {
    if (error instanceof PaidCourseError) return res.status(error.status).json({ error: error.message, code: error.code, courseId: error.courseId, priceCents: error.priceCents });
    if (error instanceof PlanError) return res.status(error.status).json({ error: error.message });
    return res.status(500).json({ error: 'Erro ao buscar detalhes da aula' });
  }
};

export const completeLesson = async (req: AuthRequest, res: Response) => {
  try {
    const account = await currentAccess(req);
    if (account.role !== 'aluno') return res.status(403).json({ error: 'A conclusão de aulas é exclusiva dos alunos.' });
    const lesson = await prisma.lesson.findFirst({ where: { id: req.params.id, archivedAt: null, module: { archivedAt: null, OR: [{ periodId: null }, { period: { archivedAt: null } }] } }, include: { module: { include: { course: true } } } });
    if (!lesson) return res.status(404).json({ error: 'Aula não encontrada.' });
    await assertCourseContentAccess(account, lesson.module.course);
    if (!await studentCanAccessLesson(lesson.id, account.id, account.role)) return res.status(403).json({ error: 'Conclua a aula anterior primeiro.' });
    await prisma.lessonCompletion.upsert({ where: { userId_lessonId: { userId: account.id, lessonId: lesson.id } }, create: { userId: account.id, lessonId: lesson.id }, update: {} });
    const state = await learningState(lesson.moduleId, account.id, account.role);
    const next = state.lessons.find(item => !item.completed);
    return res.json({ completed: true, nextLessonId: next?.id ?? null, finalExamUnlocked: state.complete });
  } catch (error) {
    if (error instanceof PaidCourseError) return res.status(error.status).json({ error: error.message });
    if (error instanceof PlanError) return res.status(error.status).json({ error: error.message });
    return res.status(503).json({ error: 'Não foi possível registrar a conclusão.' });
  }
};
