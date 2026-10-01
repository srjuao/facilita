import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getExams = async (req: Request, res: Response) => {
  try {
    const { courseId } = req.query;
    const exams = await prisma.exam.findMany({
      where: courseId ? { courseId: String(courseId) } : undefined,
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
