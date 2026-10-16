import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest, canAccessCourse } from '../middleware/auth';
import { currentAccess } from './plan-access';
import { PlanError } from './plan-policy';
import { signedLesson } from './media-access';

const prisma = new PrismaClient();

export const getCourseDetails = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const course = await prisma.course.findUnique({
      where: { id },
      include: {
        tenant: true,
        modules: { include: { lessons: true } },
        exams: { include: { _count: { select: { questions: true } } } },
        students: true
      }
    });

    if (!course) return res.status(404).json({ error: 'Curso não encontrado' });
    const user = await currentAccess(req);
    if (!canAccessCourse(req.user, course.id)) return res.status(403).json({ error: 'Acesso negado a este curso.' });
    const plan = user.role === 'superadmin' ? null : user.tenant?.plan;

    const { students, ...courseData } = course;
    const response: Record<string, unknown> = {
      ...courseData,
      exams: plan && !plan.provas ? [] : course.exams,
      modules: course.modules.map(m => ({
        ...m,
        lessons: plan && !plan.videoAulas ? [] : m.lessons.map(lesson => signedLesson(lesson, user.id)),
        lista: plan && !plan.videoAulas ? [] : JSON.parse(m.lista || '[]')
      }))
    };

    // An enrolled student may view course material, but must never receive peer records.
    if (req.user?.role !== 'aluno') {
      response.students = students.map(s => ({
        ...s,
        atividade: JSON.parse(s.atividade || '[]'),
        weeks: JSON.parse(s.weeks || '[]'),
        notas: JSON.parse(s.notas || '{}'),
        tempos: JSON.parse(s.tempos || '{}'),
      }));
    }
    return res.json(response);
  } catch (error) {
    if (error instanceof PlanError) return res.status(error.status).json({ error: error.message });
    return res.status(500).json({ error: 'Erro ao buscar curso' });
  }
};
