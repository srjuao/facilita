import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getStudents = async (req: Request, res: Response) => {
  try {
    const { courseId, risco, sub, search } = req.query;

    const where: any = {};
    if (courseId) where.courseId = String(courseId);
    if (risco) where.risco = String(risco);
    if (sub) where.sub = String(sub);
    if (search) where.nome = { contains: String(search) };

    const students = await prisma.student.findMany({ where });

    return res.json(students.map(s => ({
      ...s,
      atividade: JSON.parse(s.atividade || '[]'),
      weeks: JSON.parse(s.weeks || '[]'),
      notas: JSON.parse(s.notas || '{}'),
      tempos: JSON.parse(s.tempos || '{}'),
    })));
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar estudantes' });
  }
};

export const getStudentById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const student = await prisma.student.findUnique({
      where: { id: Number(id) },
      include: { course: true }
    });

    if (!student) return res.status(404).json({ error: 'Estudante não encontrado' });

    return res.json({
      ...student,
      atividade: JSON.parse(student.atividade || '[]'),
      weeks: JSON.parse(student.weeks || '[]'),
      notas: JSON.parse(student.notas || '{}'),
      tempos: JSON.parse(student.tempos || '{}'),
    });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar estudante' });
  }
};
