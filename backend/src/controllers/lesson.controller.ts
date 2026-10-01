import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getLessonsByModule = async (req: Request, res: Response) => {
  try {
    const { moduleId } = req.query;
    const lessons = await prisma.lesson.findMany({
      where: moduleId ? { moduleId: String(moduleId) } : undefined,
      include: { module: true }
    });
    return res.json(lessons);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar aulas' });
  }
};

export const getLessonById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const lesson = await prisma.lesson.findUnique({
      where: { id },
      include: { module: { include: { lessons: true } } }
    });

    if (!lesson) return res.status(404).json({ error: 'Aula não encontrada' });

    return res.json(lesson);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar detalhes da aula' });
  }
};
