import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getTenants = async (req: Request, res: Response) => {
  try {
    const tenants = await prisma.tenant.findMany({
      include: { courses: true }
    });
    return res.json(tenants);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar faculdades' });
  }
};

export const getTenantById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: { courses: true }
    });
    if (!tenant) return res.status(404).json({ error: 'Faculdade não encontrada' });
    return res.json(tenant);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar faculdade' });
  }
};
