import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';

type Profile = { nome: string; email: string };
export type ProfileStore = {
  find: (id: string) => Promise<{ id: string; role: string } | null>;
  replace: (id: string, profile: Profile) => Promise<boolean>;
};

export const createUpdateProfileHandler = (store: ProfileStore) => async (req: AuthRequest, res: Response) => {
  if (!req.user || !['superadmin', 'platform_staff'].includes(req.user.role)) return res.status(403).json({ error: 'Acesso exclusivo da equipe Facilita.' });
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !['nome', 'email'].includes(key))) {
    return res.status(400).json({ error: 'Envie apenas nome e e-mail para atualizar seu cadastro.' });
  }
  if (typeof body.nome !== 'string' || typeof body.email !== 'string') return res.status(400).json({ error: 'Preencha nome e e-mail.' });
  const nome = body.nome.trim();
  const email = body.email.trim().toLowerCase();
  if (nome.length < 2 || nome.length > 120 || /[\u0000-\u001f\u007f]/.test(nome)) return res.status(400).json({ error: 'O nome deve ter entre 2 e 120 caracteres.' });
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Informe um e-mail válido, com até 254 caracteres.' });
  try {
    const account = await store.find(req.user.id);
    if (!account || !['superadmin', 'platform_staff'].includes(account.role)) return res.status(403).json({ error: 'Acesso exclusivo da equipe Facilita.' });
    // The store must check the current role again as part of the write.
    if (!await store.replace(account.id, { nome, email })) return res.status(403).json({ error: 'Sua conta não possui mais permissão para esta alteração.' });
    return res.json({ message: 'Informações da conta atualizadas com sucesso.', user: { id: account.id, nome, email } });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') return res.status(409).json({ error: 'Este e-mail já está em uso por outra conta.' });
    return res.status(500).json({ error: 'Não foi possível atualizar sua conta. Tente novamente.' });
  }
};
