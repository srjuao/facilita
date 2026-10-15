import React, { FormEvent, useState } from 'react';
import { TopBar } from '../../components/TopBar';
import { useAuth } from '../../auth/AuthContext';
import api from '../../api/client';

export const SuperAdminAccount: React.FC = () => {
  const { user } = useAuth();
  const [form, setForm] = useState({ newPassword: '', confirmPassword: '' });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (saving) return;
    setNotice(null);
    if (form.newPassword !== form.confirmPassword) { setNotice({ error: true, text: 'A confirmação não corresponde à nova senha.' }); return; }
    if (form.newPassword.length < 8 || !/[A-Za-z]/.test(form.newPassword) || !/\d/.test(form.newPassword) || !/[^A-Za-z0-9]/.test(form.newPassword)) { setNotice({ error: true, text: 'Use pelo menos 8 caracteres, com letra, número e caractere especial.' }); return; }
    setSaving(true);
    try {
      const response = await api.patch('/auth/password', form);
      setForm({ newPassword: '', confirmPassword: '' });
      setNotice({ error: false, text: response.data.message });
    } catch (error: any) { setNotice({ error: true, text: error.response?.data?.error || 'Não foi possível alterar a senha. Verifique sua conexão e tente novamente.' }); }
    finally { setSaving(false); }
  };
  return <div><TopBar currentPage="Minha conta" /><section className="account-settings"><p className="eyebrow">CONTA DO SUPERADMIN</p><h1>Minha conta</h1><p className="muted">{user?.nome} · {user?.email}</p><form className="card account-password" onSubmit={submit}><h2>Trocar senha</h2><p className="muted">Escolha a senha que usará nos próximos acessos.</p>{notice && <div className={notice.error ? 'inline-form-error' : 'identity-success'} role={notice.error ? 'alert' : 'status'}>{notice.text}</div>}<fieldset disabled={saving}><label htmlFor="account-new-password">Nova senha</label><input id="account-new-password" type="password" autoComplete="new-password" required minLength={8} aria-describedby="account-password-rule" value={form.newPassword} onChange={event => setForm({ ...form, newPassword: event.target.value })} /><small id="account-password-rule">Ao menos 8 caracteres, com letra, número e caractere especial.</small><label htmlFor="account-confirm-password">Confirmar nova senha</label><input id="account-confirm-password" type="password" autoComplete="new-password" required minLength={8} value={form.confirmPassword} onChange={event => setForm({ ...form, confirmPassword: event.target.value })} /><button className="btn primary" type="submit">{saving ? 'Salvando…' : 'Salvar nova senha'}</button></fieldset></form></section></div>;
};
