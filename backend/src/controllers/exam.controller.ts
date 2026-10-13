import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest, canAccessCourse } from '../middleware/auth';

const prisma = new PrismaClient();

export const getExams = async (req: AuthRequest, res: Response) => {
  try {
    const { courseId } = req.query;
    const requestedCourseId = courseId ? String(courseId) : undefined;
    if (requestedCourseId && !canAccessCourse(req.user, requestedCourseId)) return res.status(403).json({ error: 'Acesso negado a este curso.' });
    const scopedCourseId = req.user?.role === 'superadmin' ? requestedCourseId : req.user?.courseId;
    if (!scopedCourseId && req.user?.role !== 'superadmin') return res.status(403).json({ error: 'Curso não associado ao usuário.' });
    const exams = await prisma.exam.findMany({
      where: scopedCourseId ? { courseId: scopedCourseId } : undefined,
      include: { questions: true }
    });

    return res.json(exams.map(e => ({
      ...e,
      questions: e.questions.map(q => ({
        ...q,
        alts: JSON.parse(q.alts || '[]'),
        dist: JSON.parse(q.dist || '[]')
      }))
    })));
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar simulados' });
  }
};
