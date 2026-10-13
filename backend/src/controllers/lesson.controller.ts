import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest, canAccessCourse } from '../middleware/auth';

const prisma = new PrismaClient();

export const getLessonsByModule = async (req: AuthRequest, res: Response) => {
  try {
    const { moduleId } = req.query;
    if (req.user?.role !== 'superadmin' && !req.user?.courseId) {
      return res.status(403).json({ error: 'Curso não associado ao usuário.' });
    }
    const lessons = await prisma.lesson.findMany({
      where: {
        ...(moduleId ? { moduleId: String(moduleId) } : {}),
        ...(req.user?.role === 'superadmin' ? {} : { module: { courseId: req.user?.courseId } })
      },
      include: { module: true }
    });
    return res.json(lessons);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar aulas' });
  }
};

export const getLessonById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const lesson = await prisma.lesson.findUnique({
      where: { id },
      include: { module: { include: { lessons: true } } }
    });

    if (!lesson) return res.status(404).json({ error: 'Aula não encontrada' });
    if (!canAccessCourse(req.user, lesson.module.courseId)) return res.status(403).json({ error: 'Acesso negado a esta aula.' });

    return res.json(lesson);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar detalhes da aula' });
  }
};
