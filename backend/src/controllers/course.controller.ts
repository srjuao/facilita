import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest, canAccessCourse } from '../middleware/auth';

const prisma = new PrismaClient();

export const getCourseDetails = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const course = await prisma.course.findUnique({
      where: { id },
      include: {
        tenant: true,
        modules: true,
        exams: true,
        students: true
      }
    });

    if (!course) return res.status(404).json({ error: 'Curso não encontrado' });
    if (!canAccessCourse(req.user, course.id)) return res.status(403).json({ error: 'Acesso negado a este curso.' });

    const { students, ...courseData } = course;
    const response: Record<string, unknown> = {
      ...courseData,
      modules: course.modules.map(m => ({
        ...m,
        lista: JSON.parse(m.lista || '[]')
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
    return res.status(500).json({ error: 'Erro ao buscar curso' });
  }
};
