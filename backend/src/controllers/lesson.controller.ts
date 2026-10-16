import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest, canAccessCourse } from '../middleware/auth';
import { signedLesson } from './media-access';

const prisma = new PrismaClient();

export const getLessonsByModule = async (req: AuthRequest, res: Response) => {
  try {
    const { moduleId } = req.query;
    if (!['superadmin', 'coord'].includes(req.user?.role || '') && !req.user?.courseId) {
      return res.status(403).json({ error: 'Curso não associado ao usuário.' });
    }
    const lessons = await prisma.lesson.findMany({
      where: {
        ...(moduleId ? { moduleId: String(moduleId) } : {}),
        ...(req.user?.role === 'superadmin' ? {} : req.user?.role === 'coord' ? { module: { course: { tenantId: req.user.tenantId } } } : { module: { courseId: req.user?.courseId } })
      },
      include: { module: true }
    });
    return res.json(lessons.map(lesson => signedLesson(lesson, req.user!.id)));
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar aulas' });
  }
};

export const getLessonById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const lesson = await prisma.lesson.findUnique({
      where: { id },
      include: { module: { include: { lessons: true, course: { select: { tenantId: true } } } } }
    });

    if (!lesson) return res.status(404).json({ error: 'Aula não encontrada' });
    if (!(req.user?.role === 'coord' && req.user.tenantId === lesson.module.course.tenantId) && !canAccessCourse(req.user, lesson.module.courseId)) return res.status(403).json({ error: 'Acesso negado a esta aula.' });

    return res.json({ ...signedLesson(lesson, req.user!.id), module: { ...lesson.module, lessons: lesson.module.lessons.map(item => signedLesson(item, req.user!.id)) } });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar detalhes da aula' });
  }
};
