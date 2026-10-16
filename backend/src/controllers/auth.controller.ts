import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { generateToken, AuthRequest } from '../middleware/auth';
import { createChangePasswordHandler } from './change-password';
import { createUpdateProfileHandler } from './update-profile';

const prisma = new PrismaClient();
const publicPlan = { select: { id: true, nome: true, videoAulas: true, provas: true, ia: true, studentLimit: true } } as const;

export const updateProfile = createUpdateProfileHandler({
  find: id => prisma.user.findUnique({ where: { id }, select: { id: true, role: true } }),
  replace: async (id, profile) => {
    const result = await prisma.user.updateMany({ where: { id, role: 'superadmin' }, data: profile });
    return result.count === 1;
  }
});

export const changePassword = createChangePasswordHandler({
  find: id => prisma.user.findUnique({ where: { id }, select: { id: true, role: true, password: true } }),
  replace: async (id, previousHash, newHash) => {
    const result = await prisma.user.updateMany({ where: { id, role: 'superadmin', password: previousHash }, data: { password: newHash } });
    return result.count === 1;
  }
});

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || typeof password !== 'string' || password.length === 0) {
      return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      include: { tenant: { include: { plan: publicPlan } }, course: true, student: true }
    });

    if (!user) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    if (user.role !== 'superadmin' && user.tenant && !user.tenant.ativo) {
      return res.status(403).json({ error: 'Esta instituição está temporariamente desativada.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      courseId: user.courseId,
      studentId: user.studentId
    });

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        nome: user.nome,
        papel: user.papel,
        role: user.role,
        photo: user.photo,
        permissions: user.permissions,
        departmentId: user.departmentId,
        tenantId: user.tenantId,
        courseId: user.courseId,
        studentId: user.studentId,
        tenant: user.tenant,
        course: user.course,
        student: user.student
      }
    });
  } catch (error) {
    console.error('Erro no login:', error);
    return res.status(500).json({ error: 'Erro interno no servidor.' });
  }
};

export const getMe = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Não autenticado' });

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { tenant: { include: { plan: publicPlan } }, course: true, student: true }
    });

    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
    if (user.role !== 'superadmin' && user.tenant && !user.tenant.ativo) {
      return res.status(403).json({ error: 'Esta instituição está temporariamente desativada.' });
    }

    const { password: _password, ...safeUser } = user;
    return res.json(safeUser);
  } catch (error) {
    return res.status(500).json({ error: 'Erro interno no servidor' });
  }
};
