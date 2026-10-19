import React, { FormEvent, useState } from 'react';
import { TopBar } from '../../components/TopBar';
import { useAuth } from '../../auth/AuthContext';
import api from '../../api/client';

export const SuperAdminAccount: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [profile, setProfile] = useState({ nome: user?.nome || '', email: user?.email || '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileNotice, setProfileNotice] = useState<{ error: boolean; text: string } | null>(null);
  const submitProfile = async (event: FormEvent) => {
    event.preventDefault(); if (savingProfile) return;
    setProfileNotice(null);
    if (profile.nome.trim().length < 2 || profile.nome.trim().length > 120 || !/^\S+@\S+\.\S+$/.test(profile.email.trim())) {
      setProfileNotice({ error: true, text: 'Informe seu nome e um e-mail válido.' }); return;
    }
    setSavingProfile(true);
    try {
      await api.patch('/auth/profile', { nome: profile.nome.trim(), email: profile.email.trim().toLowerCase() });
      setProfile(current => ({ nome: current.nome.trim(), email: current.email.trim().toLowerCase() }));
      try {
        await refreshUser();
        setProfileNotice({ error: false, text: 'Dados da conta atualizados. Use o e-mail salvo no próximo acesso.' });
      } catch {
        setProfileNotice({ error: false, text: 'Dados salvos. Recarregue a página para atualizar o nome no menu.' });
      }
    } catch (error: any) {
      setProfileNotice({ error: true, text: error.response?.data?.error || 'Não foi possível salvar seus dados. Tente novamente.' });
    } finally { setSavingProfile(false); }
  };
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
  return <div><TopBar currentPage="Minha conta" /><section className="account-settings"><p className="eyebrow">CONTA DA EQUIPE FACILITA</p><h1>Minha conta</h1><p className="muted">{user?.nome} · {user?.email}</p><form className="card account-password" onSubmit={submitProfile}><h2>Dados pessoais</h2><p className="muted">Atualize seu nome e e-mail de acesso.</p>{profileNotice && <div className={profileNotice.error ? 'inline-form-error' : 'identity-success'} role={profileNotice.error ? 'alert' : 'status'}>{profileNotice.text}</div>}<fieldset disabled={savingProfile}><label htmlFor="account-name">Nome completo</label><input id="account-name" autoComplete="name" required minLength={2} maxLength={120} value={profile.nome} onChange={event => setProfile({ ...profile, nome: event.target.value })} /><label htmlFor="account-email">E-mail de acesso</label><input id="account-email" type="email" autoComplete="email" required maxLength={254} value={profile.email} onChange={event => setProfile({ ...profile, email: event.target.value })} /><small>O perfil e as permissões são definidos pela administração geral.</small><button className="btn primary" type="submit">{savingProfile ? 'Salvando…' : 'Salvar dados da conta'}</button></fieldset></form><form className="card account-password" onSubmit={submit}><h2>Trocar senha</h2><p className="muted">Escolha a senha que usará nos próximos acessos.</p>{notice && <div className={notice.error ? 'inline-form-error' : 'identity-success'} role={notice.error ? 'alert' : 'status'}>{notice.text}</div>}<fieldset disabled={saving}><label htmlFor="account-new-password">Nova senha</label><input id="account-new-password" type="password" autoComplete="new-password" required minLength={8} aria-describedby="account-password-rule" value={form.newPassword} onChange={event => setForm({ ...form, newPassword: event.target.value })} /><small id="account-password-rule">Ao menos 8 caracteres, com letra, número e caractere especial.</small><label htmlFor="account-confirm-password">Confirmar nova senha</label><input id="account-confirm-password" type="password" autoComplete="new-password" required minLength={8} value={form.confirmPassword} onChange={event => setForm({ ...form, confirmPassword: event.target.value })} /><button className="btn primary" type="submit">{saving ? 'Salvando…' : 'Salvar nova senha'}</button></fieldset></form></section></div>;
};
