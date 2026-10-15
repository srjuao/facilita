import { Request, Response } from 'express';
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

const hasValidPassword = (value: string) => value.length >= 8 && /[A-Za-z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);

export const getTenants = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'superadmin' && !req.user?.tenantId) {
      return res.status(403).json({ error: 'Instituição não associada ao usuário.' });
    }
    const tenants = await prisma.tenant.findMany({
      where: req.user?.role === 'superadmin'
        ? undefined
        : { id: req.user?.tenantId, ativo: true },
      include: { courses: true },
      orderBy: [{ ativo: 'desc' }, { nome: 'asc' }]
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
    if (!tenant || (!tenant.ativo && req.user?.role !== 'superadmin')) return res.status(404).json({ error: 'Faculdade não encontrada' });
    if (!canAccessTenant(req.user, tenant.id)) return res.status(403).json({ error: 'Acesso negado a esta faculdade.' });
    return res.json(tenant);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar faculdade' });
  }
};

export const createTenant = async (req: AuthRequest, res: Response) => {
  try {
    const { nome, full, cidade, subdomain, admin, adminEmail, adminPassword } = req.body as Record<string, string>;
    if (!nome?.trim() || !full?.trim() || !cidade?.trim() || !subdomain?.trim() || !admin?.trim() || !adminEmail?.trim() || !adminPassword) {
      return res.status(400).json({ error: 'Preencha os dados da faculdade e do administrador responsável.' });
    }
    if (!/^\S+@\S+\.\S+$/.test(adminEmail.trim()) || !hasValidPassword(adminPassword)) {
      return res.status(400).json({ error: 'Use um e-mail válido e uma senha com ao menos 8 caracteres, letra, número e caractere especial.' });
    }

    const slug = toSubdomain(subdomain);
    const reservedSubdomains = new Set(['app', 'www', 'api', 'mail', 'admin', 'smtp', 'imap', 'pop']);
    if (!slug || slug.length < 3 || slug.length > 63 || reservedSubdomains.has(slug)) {
      return res.status(400).json({ error: 'Use um subdomínio disponível entre 3 e 63 caracteres.' });
    }
    const dominio = `${slug}.facilitaestudos.com.br`;
    const exists = await prisma.tenant.findUnique({ where: { dominio } });
    if (exists) return res.status(409).json({ error: 'Esse subdomínio já está em uso.' });

    const normalizedAdminEmail = adminEmail.trim().toLowerCase();
    const emailExists = await prisma.user.findUnique({ where: { email: normalizedAdminEmail } });
    if (emailExists) return res.status(409).json({ error: 'Já existe uma conta com este e-mail.' });

    const tenant = await prisma.$transaction(async (tx) => {
      const created = await tx.tenant.create({
        data: {
          id: makeTenantId(), nome: nome.trim(), full: full.trim(), cidade: cidade.trim(),
          dominio, admin: admin.trim(), since: new Date().toLocaleDateString('pt-BR'),
          color: '#2f7dd1', cover: ''
        },
        include: { courses: true }
      });
      await tx.user.create({
        data: {
          nome: admin.trim(), email: normalizedAdminEmail, password: await bcrypt.hash(adminPassword, 12),
          role: 'coord', papel: `Administrador · ${created.nome}`, tenantId: created.id
        }
      });
      return created;
    });
    return res.status(201).json(tenant);
  } catch (error) {
    return res.status(500).json({ error: 'Não foi possível criar a faculdade.' });
  }
};

export const updateTenantStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { ativo } = req.body as { ativo?: unknown };
    if (typeof ativo !== 'boolean') return res.status(400).json({ error: 'Informe o novo status da unidade.' });

    const tenant = await prisma.tenant.findUnique({ where: { id: req.params.id } });
    if (!tenant) return res.status(404).json({ error: 'Faculdade não encontrada.' });

    const updated = await prisma.tenant.update({
      where: { id: tenant.id },
      data: { ativo, desativadoEm: ativo ? null : new Date() },
      include: { courses: true }
    });
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: 'Não foi possível atualizar o status da faculdade.' });
  }
};

export const updateTenantBranding = async (req: AuthRequest, res: Response) => {
  try {
    const { logoUrl = '', loginImageUrl = '', faviconUrl = '', browserTitle = '', primaryColor = '#2f7dd1' } = req.body as Record<string, unknown>;
    const values = [logoUrl, loginImageUrl, faviconUrl, browserTitle, primaryColor];
    if (values.some(value => typeof value !== 'string')) return res.status(400).json({ error: 'Os dados de identidade são inválidos.' });
    if (!/^#[0-9a-fA-F]{6}$/.test(primaryColor as string)) return res.status(400).json({ error: 'Escolha uma cor hexadecimal válida.' });
    for (const url of [logoUrl, loginImageUrl, faviconUrl] as string[]) {
      if (url && !/^https:\/\//.test(url)) return res.status(400).json({ error: 'As imagens precisam usar URLs HTTPS.' });
    }
    const updated = await prisma.tenant.update({
      where: { id: req.params.id },
      data: {
        logoUrl: (logoUrl as string).trim(), loginImageUrl: (loginImageUrl as string).trim(),
        faviconUrl: (faviconUrl as string).trim(), browserTitle: (browserTitle as string).trim(),
        primaryColor: primaryColor as string
      },
      include: { courses: true }
    });
    return res.json(updated);
  } catch {
    return res.status(404).json({ error: 'Faculdade não encontrada.' });
  }
};

export const getPublicTenantBranding = async (req: Request, res: Response) => {
  const host = String(req.headers.host || '').split(':')[0].toLowerCase();
  if (!host.endsWith('.facilitaestudos.com.br')) return res.status(204).end();
  const tenant = await prisma.tenant.findFirst({
    where: { dominio: host, ativo: true },
    select: { nome: true, dominio: true, logoUrl: true, loginImageUrl: true, faviconUrl: true, browserTitle: true, primaryColor: true }
  });
  return tenant ? res.json(tenant) : res.status(204).end();
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
    if (!tenant.ativo) return res.status(409).json({ error: 'Reative a faculdade antes de vincular usuários.' });
    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser?.tenantId && existingUser.tenantId !== tenant.id) {
      return res.status(409).json({ error: 'Essa conta já está vinculada a outra faculdade.' });
    }
    if (!existingUser && (!password || !hasValidPassword(password))) {
      return res.status(400).json({ error: 'Para uma nova conta, use senha com ao menos 8 caracteres, letra, número e caractere especial.' });
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
