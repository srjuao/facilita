import React, { useState } from 'react';
import { LockKeyhole, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { WordMark } from '../../components/WordMark';

export const SuperAdminLogin: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true); setError('');
    try { await login(email, password); }
    catch (reason: any) { setError(reason.response?.data?.error || 'Não foi possível entrar no painel.'); }
    finally { setSaving(false); }
  };

  return <main className="super-login-shell">
    <section className="super-login-brand">
      <div><WordMark /><p>OPERAÇÃO DA PLATAFORMA</p></div>
      <div><span className="super-login-mark"><ShieldCheck size={25} /></span><h1>Visão central, operação segura.</h1><p>Gerencie faculdades, acessos e status das unidades do Facilita em um único lugar.</p></div>
      <small>FacilitaEstudos · acesso restrito</small>
    </section>
    <section className="super-login-panel">
      <form className="super-login-card" onSubmit={submit}>
        <span className="super-login-mark light"><LockKeyhole size={21} /></span>
        <p className="eyebrow">PAINEL DE SUPERADMIN</p>
        <h2>Entrar na operação</h2>
        <p className="muted">Use as credenciais exclusivas de superadmin.</p>
        <label>E-mail<input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="username" required /></label>
        <label>Senha<input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" required /></label>
        {error && <div className="super-login-error" role="alert">{error}</div>}
        <button className="primary" disabled={saving}>{saving ? 'Validando…' : 'Acessar painel'}</button>
      </form>
    </section>
  </main>;
};
