import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest, canAccessCourse } from '../middleware/auth';

const prisma = new PrismaClient();

export const getStudents = async (req: AuthRequest, res: Response) => {
  try {
    const { courseId, risco, sub, search } = req.query;

    const where: any = {};
    const requestedCourseId = courseId ? String(courseId) : undefined;
    if (req.user?.role === 'aluno') {
      if (!req.user.studentId) return res.status(403).json({ error: 'Perfil de aluno inválido.' });
      where.id = req.user.studentId;
    } else if (req.user?.role !== 'superadmin') {
      if (!req.user?.courseId) return res.status(403).json({ error: 'Curso não associado ao usuário.' });
      if (requestedCourseId && !canAccessCourse(req.user, requestedCourseId)) return res.status(403).json({ error: 'Acesso negado a este curso.' });
      where.courseId = req.user.courseId;
    } else if (requestedCourseId) {
      where.courseId = requestedCourseId;
    }
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

export const getStudentById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const student = await prisma.student.findUnique({
      where: { id: Number(id) },
      include: { course: true }
    });

    if (!student) return res.status(404).json({ error: 'Estudante não encontrado' });
    if (req.user?.role === 'aluno' && req.user.studentId !== student.id) return res.status(403).json({ error: 'Acesso negado a este estudante.' });
    if (req.user?.role !== 'superadmin' && !canAccessCourse(req.user, student.courseId)) return res.status(403).json({ error: 'Acesso negado a este curso.' });

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
