import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET não configurado ou inseguro. Configure um segredo aleatório com ao menos 32 caracteres.');
  }
  return secret;
};

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    tenantId?: string;
    courseId?: string;
    studentId?: number;
  };
}

export type UserRole = 'superadmin' | 'coord' | 'professor' | 'aluno';

const USER_ROLES: UserRole[] = ['superadmin', 'coord', 'professor', 'aluno'];

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Acesso não autorizado. Token não fornecido.' });
  }

  let secret: string;
  try {
    secret = getJwtSecret();
  } catch {
    return res.status(503).json({ error: 'Autenticação temporariamente indisponível.' });
  }

  jwt.verify(token, secret, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido ou expirado.' });
    }
    const payload = user as AuthRequest['user'];
    if (!payload?.id || !USER_ROLES.includes(payload.role as UserRole)) {
      return res.status(403).json({ error: 'Token sem permissões válidas.' });
    }
    req.user = payload;
    next();
  });
};

/** Restrict a route to the application roles that have a business need for it. */
export const authorizeRoles = (...roles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role as UserRole)) {
      return res.status(403).json({ error: 'Você não tem permissão para esta ação.' });
    }
    next();
  };
};

export const canAccessCourse = (user: AuthRequest['user'], courseId: string) => {
  if (!user) return false;
  return user.role === 'superadmin' || (Boolean(user.courseId) && user.courseId === courseId);
};

export const canAccessTenant = (user: AuthRequest['user'], tenantId: string) => {
  if (!user) return false;
  return user.role === 'superadmin' || (Boolean(user.tenantId) && user.tenantId === tenantId);
};

export const generateToken = (payload: object) => {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' });
};
