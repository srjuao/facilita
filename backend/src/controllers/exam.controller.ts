import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { currentAccess } from './plan-access';
import { PlanError } from './plan-policy';
import { assertCourseContentAccess, PaidCourseError } from '../commerce/access';

const prisma = new PrismaClient();

export const getExams = async (req: AuthRequest, res: Response) => {
  try {
    const { courseId } = req.query;
    const account = await currentAccess(req);
    const requestedCourseId = courseId ? String(courseId) : undefined;
    const scopedCourseId = requestedCourseId || account.courseId || undefined;
    if (!scopedCourseId && account.role !== 'superadmin') return res.status(403).json({ error: 'Curso não associado ao usuário.' });
    if (scopedCourseId) {
      const course = await prisma.course.findUnique({ where: { id: scopedCourseId } });
      if (!course) return res.status(404).json({ error: 'Curso não encontrado.' });
      await assertCourseContentAccess(account, course);
    }
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
    if (error instanceof PaidCourseError) return res.status(error.status).json({ error: error.message, code: error.code, courseId: error.courseId, priceCents: error.priceCents });
    if (error instanceof PlanError) return res.status(error.status).json({ error: error.message });
    return res.status(500).json({ error: 'Erro ao buscar simulados' });
  }
};
