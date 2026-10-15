import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { AuthRequest, generateToken } from '../middleware/auth';

const prisma = new PrismaClient();
const validPassword = (value: string) => value.length >= 8 && /[A-Za-z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);
const courseId = () => `course_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const tenantForCoordinator = async (req: AuthRequest, res: Response) => {
  if (!req.user?.tenantId) {
    res.status(403).json({ error: 'Sua conta não está vinculada a uma unidade.' });
    return null;
  }
  const tenant = await prisma.tenant.findUnique({ where: { id: req.user.tenantId } });
  if (!tenant || !tenant.ativo) {
    res.status(403).json({ error: 'Esta unidade não está disponível.' });
    return null;
  }
  return tenant;
};

export const getCoordCourses = async (req: AuthRequest, res: Response) => {
  try {
    const tenant = await tenantForCoordinator(req, res);
    if (!tenant) return;
    const courses = await prisma.course.findMany({
      where: { tenantId: tenant.id },
      orderBy: { nome: 'asc' },
      include: { users: { where: { role: 'professor' }, select: { id: true, nome: true, email: true } } }
    });
    return res.json(courses);
  } catch {
    return res.status(500).json({ error: 'Não foi possível listar os cursos da unidade.' });
  }
};

export const createCoordCourse = async (req: AuthRequest, res: Response) => {
  try {
    const tenant = await tenantForCoordinator(req, res);
    if (!tenant) return;
    const currentUserId = req.user?.id;
    const currentCourseId = req.user?.courseId;
    if (!currentUserId) return res.status(401).json({ error: 'Sessão inválida.' });
    const nome = String(req.body?.nome || '').trim();
    if (nome.length < 2 || nome.length > 80) return res.status(400).json({ error: 'Informe um nome de curso entre 2 e 80 caracteres.' });
    const course = await prisma.course.create({
      data: { id: courseId(), nome, status: 'Em implantação', tenantId: tenant.id },
      include: { users: { where: { role: 'professor' }, select: { id: true, nome: true, email: true } } }
    });
    let token: string | undefined;
    if (!currentCourseId) {
      const currentUser = await prisma.user.update({
        where: { id: currentUserId },
        data: { courseId: course.id, papel: `Coordenação · ${course.nome}` },
        include: { tenant: true, course: true, student: true }
      });
      token = generateToken({ id: currentUser.id, email: currentUser.email, role: currentUser.role, tenantId: currentUser.tenantId, courseId: currentUser.courseId, studentId: currentUser.studentId });
    }
    return res.status(201).json({ course, token });
  } catch {
    return res.status(500).json({ error: 'Não foi possível criar o curso.' });
  }
};

export const createCoordTeacher = async (req: AuthRequest, res: Response) => {
  try {
    const tenant = await tenantForCoordinator(req, res);
    if (!tenant) return;
    const { nome, email, password, courseId: targetCourseId } = req.body as Record<string, string>;
    if (!nome?.trim() || !email?.trim() || !targetCourseId || !validPassword(password || '')) {
      return res.status(400).json({ error: 'Informe nome, e-mail, curso e senha com 8 caracteres, letra, número e caractere especial.' });
    }
    const course = await prisma.course.findFirst({ where: { id: targetCourseId, tenantId: tenant.id } });
    if (!course) return res.status(404).json({ error: 'Curso não encontrado nesta unidade.' });
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing && existing.tenantId !== tenant.id) return res.status(409).json({ error: 'Este e-mail já pertence a outra unidade.' });
    if (existing && existing.role !== 'professor') return res.status(409).json({ error: 'Este e-mail já está em uso por uma conta que não é de professor.' });
    const user = existing
      ? await prisma.user.update({ where: { id: existing.id }, data: { nome: nome.trim(), courseId: course.id, papel: `Professor · ${course.nome}` }, select: { id: true, nome: true, email: true } })
      : await prisma.user.create({ data: { nome: nome.trim(), email: normalizedEmail, password: await bcrypt.hash(password, 12), role: 'professor', papel: `Professor · ${course.nome}`, tenantId: tenant.id, courseId: course.id }, select: { id: true, nome: true, email: true } });
    return res.status(201).json(user);
  } catch {
    return res.status(500).json({ error: 'Não foi possível cadastrar o professor.' });
  }
};
