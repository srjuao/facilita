import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getCourseDetails = async (req: Request, res: Response) => {
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

    return res.json({
      ...course,
      modules: course.modules.map(m => ({
        ...m,
        lista: JSON.parse(m.lista || '[]')
      })),
      students: course.students.map(s => ({
        ...s,
        atividade: JSON.parse(s.atividade || '[]'),
        weeks: JSON.parse(s.weeks || '[]'),
        notas: JSON.parse(s.notas || '{}'),
        tempos: JSON.parse(s.tempos || '{}'),
      }))
    });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar curso' });
  }
};
