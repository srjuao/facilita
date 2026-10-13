import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { AuthRequest, canAccessTenant } from '../middleware/auth';

const prisma = new PrismaClient();

const makeTenantId = () => `tenant_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const toSubdomain = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

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

export const createTenant = async (req: AuthRequest, res: Response) => {
  try {
    const { nome, full, cidade, subdomain, admin } = req.body as Record<string, string>;
    if (!nome?.trim() || !full?.trim() || !cidade?.trim() || !subdomain?.trim() || !admin?.trim()) {
      return res.status(400).json({ error: 'Preencha nome, razão social, cidade, subdomínio e responsável.' });
    }

    const slug = toSubdomain(subdomain);
    const reservedSubdomains = new Set(['app', 'www', 'api', 'mail', 'admin', 'smtp', 'imap', 'pop']);
    if (!slug || slug.length < 3 || slug.length > 63 || reservedSubdomains.has(slug)) {
      return res.status(400).json({ error: 'Use um subdomínio disponível entre 3 e 63 caracteres.' });
    }
    const dominio = `${slug}.facilitaestudos.com.br`;
    const exists = await prisma.tenant.findUnique({ where: { dominio } });
    if (exists) return res.status(409).json({ error: 'Esse subdomínio já está em uso.' });

    const tenant = await prisma.tenant.create({
      data: {
        id: makeTenantId(), nome: nome.trim(), full: full.trim(), cidade: cidade.trim(),
        dominio, admin: admin.trim(), since: new Date().toLocaleDateString('pt-BR'),
        color: '#2f7dd1', cover: ''
      },
      include: { courses: true }
    });
    return res.status(201).json(tenant);
  } catch (error) {
    return res.status(500).json({ error: 'Não foi possível criar a faculdade.' });
  }
};

export const getTenantUsers = async (req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      where: { tenantId: req.params.id },
      select: { id: true, nome: true, email: true, papel: true, role: true, photo: true, courseId: true },
      orderBy: { nome: 'asc' }
    });
    return res.json(users);
  } catch (error) {
    return res.status(500).json({ error: 'Não foi possível buscar os usuários.' });
  }
};

export const createTenantUser = async (req: AuthRequest, res: Response) => {
  try {
    const { nome, email, role, password } = req.body as Record<string, string>;
    if (!nome?.trim() || !email?.trim() || !['coord', 'aluno'].includes(role)) {
      return res.status(400).json({ error: 'Preencha nome, e-mail e perfil.' });
    }
    const tenant = await prisma.tenant.findUnique({ where: { id: req.params.id } });
    if (!tenant) return res.status(404).json({ error: 'Faculdade não encontrada.' });
    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser?.tenantId && existingUser.tenantId !== tenant.id) {
      return res.status(409).json({ error: 'Essa conta já está vinculada a outra faculdade.' });
    }
    if (!existingUser && (!password || password.length < 12)) {
      return res.status(400).json({ error: 'Para uma nova conta, defina uma senha temporária de ao menos 12 caracteres.' });
    }
    const safeSelect = { id: true, nome: true, email: true, papel: true, role: true, photo: true, courseId: true } as const;
    const user = existingUser
      ? await prisma.user.update({
        where: { id: existingUser.id },
        data: { tenantId: tenant.id, role, papel: role === 'coord' ? 'Coordenação' : 'Aluno' },
        select: safeSelect
      })
      : await prisma.user.create({ data: {
        nome: nome.trim(), email: normalizedEmail, password: await bcrypt.hash(password, 12), role,
        papel: role === 'coord' ? 'Coordenação' : 'Aluno', tenantId: tenant.id
      }, select: safeSelect });
    return res.status(201).json(user);
  } catch (error) {
    return res.status(500).json({ error: 'Não foi possível vincular o usuário.' });
  }
};
