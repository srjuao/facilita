import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { generateToken, AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || typeof password !== 'string' || password.length === 0) {
      return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      include: { tenant: true, course: true, student: true }
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
      include: { tenant: true, course: true, student: true }
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
