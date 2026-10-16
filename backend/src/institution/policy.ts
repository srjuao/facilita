import { PrismaClient } from '@prisma/client';
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';

export const institutionDb = new PrismaClient();
export const PERMISSIONS = ['content.manage', 'students.manage', 'notices.manage', 'classes.manage', 'chat.create', 'exams.manage'] as const;
export const STAFF_PERMISSIONS = ['students.manage', 'notices.manage', 'chat.create', 'finance.manage'] as const;
export type InstitutionPermission = typeof PERMISSIONS[number];
export type InstitutionRequest = AuthRequest & { institution?: { id: string; tenantId: string; role: string; courseId: string | null; permissions: string[] } };
export const effectivePermissions = (role: string, permissions: string[]) => role === 'coord'
  ? [...PERMISSIONS] : role === 'professor' ? permissions.filter(value => PERMISSIONS.includes(value as InstitutionPermission)) : role === 'staff' ? permissions.filter(value => STAFF_PERMISSIONS.includes(value as typeof STAFF_PERMISSIONS[number])) : [];

/** Session bindings always come from the current database, never stale JWT claims. */
export const requireInstitutionSession = async (req: InstitutionRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user?.id ? await institutionDb.user.findUnique({ where: { id: req.user.id }, include: { tenant: true } }) : null;
    if (!user) return res.status(401).json({ error: 'Sua sessão não está mais disponível. Entre novamente.' });
    if (user.disabledAt) return res.status(403).json({ error: 'Sua conta está desativada. Procure a coordenação.' });
    if (user.role !== 'superadmin' && (!['coord', 'professor', 'aluno', 'staff'].includes(user.role) || !user.tenant?.ativo)) {
      return res.status(403).json({ error: 'A instituição está desativada ou seu acesso não está disponível.' });
    }
    req.user = { id: user.id, email: user.email, role: user.role, tenantId: user.tenantId ?? undefined, courseId: user.courseId ?? undefined, studentId: user.studentId ?? undefined, permissions: effectivePermissions(user.role, user.permissions) };
    req.institution = { id: user.id, tenantId: user.tenantId ?? '', role: user.role, courseId: user.courseId, permissions: effectivePermissions(user.role, user.permissions) };
    next();
  } catch {
    res.status(503).json({ error: 'Não foi possível verificar suas permissões. Tente novamente.' });
  }
};

export const requireInstitutionPermission = (permission: InstitutionPermission) => async (req: InstitutionRequest, res: Response, next: NextFunction) => {
  await requireInstitutionSession(req, res, () => {
    if (req.institution?.role === 'superadmin' || req.institution?.permissions.includes(permission)) return next();
    res.status(403).json({ error: 'A coordenação não concedeu permissão para esta ação.' });
  });
};

export const cleanText = (value: unknown, max: number) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max ? value.trim() : null;
export const cleanMembers = (value: unknown) => Array.isArray(value) && value.length <= 500 && value.every(id => typeof id === 'string' && id.length > 0 && id.length <= 160)
  ? [...new Set(value as string[])] : null;
