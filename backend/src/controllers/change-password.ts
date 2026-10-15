import bcrypt from 'bcryptjs';
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';

type Account = { id: string; role: string; password: string };
export type PasswordStore = {
  find: (id: string) => Promise<Account | null>;
  replace: (id: string, previousHash: string, newHash: string) => Promise<boolean>;
};

export const createChangePasswordHandler = (store: PasswordStore) => async (req: AuthRequest, res: Response) => {
  if (!req.user || req.user.role !== 'superadmin') return res.status(403).json({ error: 'Acesso exclusivo do superadmin.' });
  const { newPassword, confirmPassword } = req.body || {};
  if (typeof newPassword !== 'string' || typeof confirmPassword !== 'string') return res.status(400).json({ error: 'Preencha a nova senha e a confirmação.' });
  if (newPassword !== confirmPassword) return res.status(400).json({ error: 'A confirmação não corresponde à nova senha.' });
  if (newPassword.length < 8 || Buffer.byteLength(newPassword, 'utf8') > 72 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) return res.status(400).json({ error: 'Use pelo menos 8 caracteres, com letra, número e caractere especial, e no máximo 72 bytes.' });
  try {
    const account = await store.find(req.user.id);
    if (!account || account.role !== 'superadmin') return res.status(403).json({ error: 'Acesso exclusivo do superadmin.' });
    if (await bcrypt.compare(newPassword, account.password)) return res.status(400).json({ error: 'Escolha uma senha diferente da atual.' });
    const hash = await bcrypt.hash(newPassword, 12);
    if (!await store.replace(account.id, account.password, hash)) return res.status(409).json({ error: 'A senha foi alterada em outra solicitação. Recarregue a página e tente novamente.' });
    return res.json({ message: 'Senha alterada com sucesso. Use a nova senha no próximo acesso.' });
  } catch {
    return res.status(500).json({ error: 'Não foi possível alterar a senha. Tente novamente.' });
  }
};
