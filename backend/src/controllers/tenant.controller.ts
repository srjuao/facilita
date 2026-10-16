import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { AuthRequest, canAccessTenant } from '../middleware/auth';
import { enforceStudentCapacity, lockTenant } from './plan-access';
import { PlanError } from './plan-policy';

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
      include: { courses: { include: { _count: { select: { students: true } } } }, _count: { select: { users: true } } },
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
    const textFields = { loginKicker: 100, loginTitle: 200, loginDescription: 1000 };
    const loginTexts: Record<string, string> = {};
    for (const [key, limit] of Object.entries(textFields)) {
      const value = req.body[key];
      if (value === undefined) continue;
      if (typeof value !== 'string' || value.length > limit) return res.status(400).json({ error: `O campo ${key === 'loginKicker' ? 'chamada' : key === 'loginTitle' ? 'título' : 'apresentação'} deve ter até ${limit} caracteres.` });
      loginTexts[key] = value.trim();
    }
    if (!/^#[0-9a-fA-F]{6}$/.test(primaryColor as string)) return res.status(400).json({ error: 'Escolha uma cor hexadecimal válida.' });
    for (const url of [logoUrl, loginImageUrl, faviconUrl] as string[]) {
      const isRemoteHttps = /^https:\/\//.test(url);
      const isOwnUpload = /^\/api\/uploads\/branding\/[a-zA-Z0-9._-]+$/.test(url);
      if (url && !isRemoteHttps && !isOwnUpload) return res.status(400).json({ error: 'Use uma URL HTTPS ou um arquivo enviado pela plataforma.' });
    }
    const updated = await prisma.tenant.update({
      where: { id: req.params.id },
      data: {
        ...loginTexts,
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
    select: { nome: true, dominio: true, logoUrl: true, loginImageUrl: true, faviconUrl: true, browserTitle: true, primaryColor: true, loginKicker: true, loginTitle: true, loginDescription: true }
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

export const updateTenantUser = async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'superadmin') return res.status(403).json({ error: 'Acesso exclusivo do superadmin.' });
  const { nome, email, role, courseId, password } = req.body || {};
  if (typeof nome !== 'string' || !nome.trim() || nome.length > 120 || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email) || email.length > 254 || !['coord', 'professor', 'aluno'].includes(role)) return res.status(400).json({ error: 'Preencha nome, e-mail válido e perfil.' });
  if (courseId !== null && courseId !== '' && typeof courseId !== 'string') return res.status(400).json({ error: 'Selecione um curso válido desta instituição.' });
  if (password !== undefined && password !== '' && (typeof password !== 'string' || !hasValidPassword(password) || Buffer.byteLength(password, 'utf8') > 72)) return res.status(400).json({ error: 'Use senha de 8 a 72 caracteres, com letra, número e caractere especial.' });
  try {
    const existing = await prisma.user.findFirst({ where: { id: req.params.userId, tenantId: req.params.id, role: { not: 'superadmin' } } });
    if (!existing) return res.status(404).json({ error: 'Usuário não encontrado nesta instituição ou conta global não editável nesta tela.' });
    const targetCourseId = courseId === undefined ? existing.courseId : courseId || null;
    if (targetCourseId && !await prisma.course.findFirst({ where: { id: targetCourseId, tenantId: req.params.id }, select: { id: true } })) return res.status(400).json({ error: 'O curso selecionado não pertence a esta instituição.' });
    if (existing.studentId && role === 'aluno' && !targetCourseId) return res.status(400).json({ error: 'Selecione um curso para manter o vínculo acadêmico deste aluno.' });
    const hash = password ? await bcrypt.hash(password, 12) : undefined;
    const updated = await prisma.$transaction(async tx => {
      await lockTenant(tx, req.params.id);
      const latest = await tx.user.findFirst({ where: { id: existing.id, tenantId: req.params.id } });
      if (!latest || latest.role !== existing.role || latest.studentId !== existing.studentId || latest.courseId !== existing.courseId) throw new PlanError(409, 'O usuário foi alterado. Atualize a tela antes de salvar.');
      if (latest.studentId) {
        const student = await tx.student.findUnique({ where: { id: latest.studentId }, include: { course: true } });
        if (!student || student.course.tenantId !== req.params.id) throw new PlanError(409, 'O vínculo acadêmico deste usuário pertence a outra instituição. Regularize-o antes de editar.');
      }
      if (role === 'aluno' && latest.role !== 'aluno' && !latest.studentId) await enforceStudentCapacity(tx, req.params.id);
      const account = await tx.user.update({
        where: { id: existing.id, tenantId: req.params.id, role: { not: 'superadmin' } },
        data: { nome: nome.trim(), email: email.trim().toLowerCase(), role, courseId: targetCourseId, papel: role === 'coord' ? 'Coordenação' : role === 'professor' ? 'Professor' : 'Aluno', ...(hash ? { password: hash } : {}) },
        select: { id: true, nome: true, email: true, papel: true, role: true, courseId: true }
      });
      if (existing.studentId) await tx.student.update({ where: { id: existing.studentId }, data: { nome: nome.trim(), ...(targetCourseId ? { courseId: targetCourseId } : {}) } });
      return account;
    });
    return res.json(updated);
  } catch (error: any) {
    if (error instanceof PlanError) return res.status(error.status).json({ error: error.message });
    if (error.code === 'P2002') return res.status(409).json({ error: 'Este e-mail já está em uso por outra conta.' });
    return res.status(500).json({ error: 'Não foi possível salvar o usuário.' });
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
    if (existingUser?.role === 'superadmin') return res.status(409).json({ error: 'Contas globais de superadmin não podem ser vinculadas como usuários da instituição.' });
    if (existingUser?.tenantId && existingUser.tenantId !== tenant.id) {
      const currentTenant = await prisma.tenant.findUnique({ where: { id: existingUser.tenantId }, select: { nome: true } });
      return res.status(409).json({ error: `Esta conta já está vinculada à unidade ${currentTenant?.nome || 'existente'}.` });
    }
    if (!existingUser && (!password || !hasValidPassword(password))) {
      return res.status(400).json({ error: 'Para uma nova conta, use senha com ao menos 8 caracteres, letra, número e caractere especial.' });
    }
    const safeSelect = { id: true, nome: true, email: true, papel: true, role: true, photo: true, courseId: true } as const;
    const user = await prisma.$transaction(async tx => {
      await lockTenant(tx, tenant.id);
      const latest = await tx.user.findUnique({ where: { email: normalizedEmail } });
      if (latest && (latest.role === 'superadmin' || latest.tenantId && latest.tenantId !== tenant.id)) throw new PlanError(409, 'Esta conta não pode ser vinculada a esta instituição.');
      if (latest?.studentId) {
        const student = await tx.student.findUnique({ where: { id: latest.studentId }, include: { course: true } });
        if (!student || student.course.tenantId !== tenant.id) throw new PlanError(409, 'Este aluno possui vínculo acadêmico em outra instituição.');
      }
      // Academic students already counted through their course must not be counted twice.
      const alreadyCounted = latest?.tenantId === tenant.id && (latest.role === 'aluno' || !!latest.studentId);
      if (role === 'aluno' && !alreadyCounted) await enforceStudentCapacity(tx, tenant.id);
      return latest
      ? await tx.user.update({
        where: { id: latest.id },
        data: { tenantId: tenant.id, role, papel: role === 'coord' ? 'Coordenação' : 'Aluno' },
        select: safeSelect
      })
      : await tx.user.create({ data: {
        nome: nome.trim(), email: normalizedEmail, password: await bcrypt.hash(password, 12), role,
        papel: role === 'coord' ? 'Coordenação' : 'Aluno', tenantId: tenant.id
      }, select: safeSelect });
    });
    return res.status(201).json(user);
  } catch (error: any) {
    if (error instanceof PlanError) return res.status(error.status).json({ error: error.message });
    if (error.code === 'P2002') return res.status(409).json({ error: 'Já existe uma conta com este e-mail.' });
    return res.status(500).json({ error: 'Não foi possível vincular o usuário.' });
  }
};
