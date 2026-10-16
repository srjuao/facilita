import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { currentAccess } from './plan-access';
import { PlanError } from './plan-policy';
import { assertCourseContentAccess, PaidCourseError } from '../commerce/access';
import { signedLesson } from './media-access';

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
    return res.json(lessons.map(lesson => signedLesson(lesson, req.user!.id)));
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
      include: { module: { include: { lessons: { where: { archivedAt: null } }, course: true } } }
    });

    if (!lesson) return res.status(404).json({ error: 'Aula não encontrada' });
    await assertCourseContentAccess(account, lesson.module.course);

    return res.json({ ...signedLesson(lesson, req.user!.id), module: { ...lesson.module, lessons: lesson.module.lessons.map(item => signedLesson(item, req.user!.id)) } });
  } catch (error) {
    if (error instanceof PaidCourseError) return res.status(error.status).json({ error: error.message, code: error.code, courseId: error.courseId, priceCents: error.priceCents });
    if (error instanceof PlanError) return res.status(error.status).json({ error: error.message });
    return res.status(500).json({ error: 'Erro ao buscar detalhes da aula' });
  }
};
