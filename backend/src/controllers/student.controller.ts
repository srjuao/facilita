import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { AuthRequest, canAccessCourse } from '../middleware/auth';
import { enforceStudentCapacity } from './plan-access';
import { PlanError } from './plan-policy';

const prisma = new PrismaClient();
const validPassword = (value: string) => value.length >= 8 && /[A-Za-z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);

export const createStudent = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.tenantId) return res.status(403).json({ error: 'Conta sem instituição associada.' });
    const targetCourseId = ['coord', 'staff'].includes(req.user.role) && typeof req.body.courseId === 'string' ? req.body.courseId : req.user.courseId;
    if (!targetCourseId || !await prisma.course.findFirst({ where: { id: targetCourseId, tenantId: req.user.tenantId } })) return res.status(400).json({ error: 'Selecione um curso da sua instituição.' });
    const { nome, matricula, email, password } = req.body as Record<string, string>;
    if (!nome?.trim() || !matricula?.trim() || !email?.trim() || !validPassword(password || '')) return res.status(400).json({ error: 'Preencha matrícula, nome, e-mail e uma senha válida.' });
    const normalizedEmail = email.trim().toLowerCase();
    const duplicateEmail = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (duplicateEmail) return res.status(409).json({ error: 'Já existe uma conta com este e-mail.' });
    const duplicateRegistration = await prisma.student.findFirst({ where: { courseId: targetCourseId, sub: matricula.trim() } });
    if (duplicateRegistration) return res.status(409).json({ error: 'Esta matrícula já está cadastrada neste curso.' });
    const result = await prisma.$transaction(async tx => {
      const account = await tx.user.findUnique({ where: { id: req.user!.id }, include: { course: true } });
      if (!account?.tenantId || account.disabledAt || !['coord', 'professor', 'staff'].includes(account.role) || account.tenantId !== req.user!.tenantId || (account.role === 'staff' && !account.permissions.includes('students.manage')) || (account.role === 'professor' && (!account.permissions.includes('students.manage') || account.courseId !== targetCourseId || account.course?.tenantId !== account.tenantId))) throw new PlanError(403, 'Seu vínculo acadêmico ou suas permissões mudaram. Entre novamente.');
      await enforceStudentCapacity(tx, account.tenantId);
      const student = await tx.student.create({ data: { nome: nome.trim(), sub: matricula.trim(), progresso: 0, nota: 0, tempo: 0, ultimo: 0, risco: 'baixo', atividade: '[]', weeks: '[]', notas: '{}', tempos: '{}', courseId: targetCourseId } });
      await tx.user.create({ data: { nome: nome.trim(), email: normalizedEmail, password: await bcrypt.hash(password, 12), papel: 'Aluno', role: 'aluno', tenantId: req.user!.tenantId!, courseId: targetCourseId, studentId: student.id } });
      return student;
    });
    return res.status(201).json(result);
  } catch (error: any) {
    if (error instanceof PlanError) return res.status(error.status).json({ error: error.message });
    if (error.code === 'P2002') return res.status(409).json({ error: 'Já existe uma conta com este e-mail.' });
    return res.status(500).json({ error: 'Não foi possível cadastrar o aluno.' });
  }
};

export const getStudents = async (req: AuthRequest, res: Response) => {
  try {
    if (['professor', 'staff'].includes(req.user?.role || '') && !req.user?.permissions?.includes('students.manage')) return res.status(403).json({ error: 'A coordenação não liberou a gestão de alunos para sua conta.' });
    const { courseId, risco, sub, search } = req.query;

    const where: any = {};
    const requestedCourseId = courseId ? String(courseId) : undefined;
    if (req.user?.role === 'aluno') {
      if (!req.user.studentId) return res.status(403).json({ error: 'Perfil de aluno inválido.' });
      where.id = req.user.studentId;
    } else if (req.user && ['coord', 'staff'].includes(req.user.role)) {
      where.course = { tenantId: req.user.tenantId };
      if (requestedCourseId) where.courseId = requestedCourseId;
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
    if (['professor', 'staff'].includes(req.user?.role || '') && !req.user?.permissions?.includes('students.manage')) return res.status(403).json({ error: 'A coordenação não liberou a gestão de alunos para sua conta.' });
    const { id } = req.params;
    const student = await prisma.student.findUnique({
      where: { id: Number(id) },
      include: { course: true }
    });

    if (!student) return res.status(404).json({ error: 'Estudante não encontrado' });
    if (req.user?.role === 'aluno' && req.user.studentId !== student.id) return res.status(403).json({ error: 'Acesso negado a este estudante.' });
    if (req.user?.role !== 'superadmin' && !(req.user && ['coord', 'staff'].includes(req.user.role) && student.course.tenantId === req.user.tenantId) && !canAccessCourse(req.user, student.courseId)) return res.status(403).json({ error: 'Acesso negado a este curso.' });

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
