import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest, canAccessTenant } from '../middleware/auth';

const prisma = new PrismaClient();

export const getTenants = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'superadmin' && !req.user?.tenantId) {
      return res.status(403).json({ error: 'Instituição não associada ao usuário.' });
    }
    const tenants = await prisma.tenant.findMany({
      where: req.user?.role === 'superadmin' ? undefined : { id: req.user?.tenantId },
      include: { courses: true }
    });
    return res.json(tenants);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar faculdades' });
  }
};

export const getTenantById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: { courses: true }
    });
    if (!tenant) return res.status(404).json({ error: 'Faculdade não encontrada' });
    if (!canAccessTenant(req.user, tenant.id)) return res.status(403).json({ error: 'Acesso negado a esta faculdade.' });
    return res.json(tenant);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar faculdade' });
  }
};
