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
    if (account.role === 'professor' && !account.permissions.includes('exams.manage')) return res.status(403).json({ error: 'Sem permissão para avaliações.' });
    const exams = await prisma.exam.findMany({
      where: { ...(scopedCourseId ? { courseId: scopedCourseId } : {}), archivedAt: null,
        ...(account.role === 'aluno' ? { published: true } : {}) },
      select: { id: true, nome: true, data: true, published: true, maxAttempts: true, passingScore: true, version: true,
        _count: { select: { questions: { where: { archivedAt: null } } } } }
    });
    // Legacy readers receive metadata only: never spread question answers or explanations.
    return res.json(exams.map(e => ({ id: e.id, nome: e.nome, data: e.data, published: e.published, maxAttempts: e.maxAttempts,
      passingScore: e.passingScore, version: e.version, q: e._count.questions, _count: e._count })));
  } catch (error) {
    if (error instanceof PaidCourseError) return res.status(error.status).json({ error: error.message, code: error.code, courseId: error.courseId, priceCents: error.priceCents });
    if (error instanceof PlanError) return res.status(error.status).json({ error: error.message });
    return res.status(500).json({ error: 'Erro ao buscar simulados' });
  }
};
