import React, { FormEvent, useEffect, useState } from 'react';
import { Pencil, Search, UsersRound, X } from 'lucide-react';
import api from '../../api/client';
import { Tenant } from '../../types';
import './TenantUsers.css';

type Member = { id: string; nome: string; email: string; role: string; papel: string; courseId: string | null };
const roles: Record<string, string> = { coord: 'Coordenação', professor: 'Professor', aluno: 'Aluno', superadmin: 'Superadmin' };
export const TenantUsers: React.FC<{ tenant: Tenant }> = ({ tenant }) => {
  const [users, setUsers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState<Member | null>(null);
  const [form, setForm] = useState({ nome: '', email: '', role: 'coord', courseId: '', password: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const load = async () => {
    setLoading(true); setLoadError(false);
    try { setUsers((await api.get(`/tenants/${tenant.id}/users`)).data); }
    catch { setLoadError(true); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [tenant.id]);
  const open = (member: Member) => {
    setEditing(member); setForm({ nome: member.nome, email: member.email, role: member.role, courseId: member.courseId || '', password: '' }); setError(''); setSuccess('');
  };
  const save = async (event: FormEvent) => {
    event.preventDefault(); if (!editing || saving) return;
    setSaving(true); setError('');
    try {
      const updated = (await api.patch(`/tenants/${tenant.id}/users/${editing.id}`, form)).data as Member;
      setUsers(current => current.map(member => member.id === updated.id ? updated : member));
      setEditing(null); setForm(current => ({ ...current, password: '' })); setSuccess(`Dados de ${updated.nome} salvos. Alterações de perfil e curso valem no próximo login do usuário.`);
    } catch (requestError: any) { setError(requestError.response?.data?.error || 'Não foi possível salvar. Tente novamente.'); }
    finally { setSaving(false); }
  };
  const normalized = query.trim().toLocaleLowerCase('pt-BR');
  const visible = users.filter(member => (!filter || member.role === filter) && `${member.nome} ${member.email}`.toLocaleLowerCase('pt-BR').includes(normalized));
  return <section className="tenant-users"><header className="tenant-users-heading"><h3><UsersRound size={20} /> Pessoas da instituição <span className="pill">{users.length}</span></h3><button type="button" className="btn" disabled={loading} onClick={() => void load()}>Atualizar lista</button></header>
    {success && <div className="identity-success" role="status">{success}</div>}
    <div className="tenant-users-filters"><label><span>Buscar pessoa</span><div><Search size={16} /><input type="search" placeholder="Nome ou e-mail" value={query} onChange={event => setQuery(event.target.value)} /></div></label><label><span>Perfil</span><select value={filter} onChange={event => setFilter(event.target.value)}><option value="">Todos os perfis</option>{Object.entries(roles).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
    {loading ? <p role="status">Carregando pessoas…</p> : loadError ? <div role="alert" className="inline-form-error">Não foi possível carregar a lista.<button className="btn" onClick={() => void load()}>Tentar novamente</button></div> : !visible.length ? <p className="tenant-users-empty">{users.length ? 'Nenhuma pessoa encontrada com esses filtros.' : 'Nenhuma pessoa vinculada a esta instituição.'}</p> : <div className="tenant-users-table"><table><thead><tr><th>Nome e e-mail</th><th>Perfil</th><th>Curso</th><th>Ações</th></tr></thead><tbody>{visible.map(member => <tr key={member.id}><td><b>{member.nome}</b><small>{member.email}</small></td><td>{roles[member.role] || member.papel}</td><td>{tenant.courses.find(course => course.id === member.courseId)?.nome || 'Sem curso associado'}</td><td>{member.role !== 'superadmin' ? <button type="button" className="btn" onClick={() => open(member)} aria-label={`Editar ${member.nome}`}><Pencil size={14} /> Editar</button> : <small>Conta global</small>}</td></tr>)}</tbody></table></div>}
    {editing && <div className="modal-backdrop"><form className="card college-form tenant-user-editor" role="dialog" aria-modal="true" aria-labelledby="edit-tenant-user-title" onSubmit={save}><button type="button" className="close" disabled={saving} aria-label="Cancelar edição" onClick={() => setEditing(null)}><X size={18} /></button><p className="eyebrow">{tenant.nome}</p><h2 id="edit-tenant-user-title">Editar usuário</h2>{error && <div className="inline-form-error" role="alert">{error}</div>}<fieldset disabled={saving}><label>Nome<input required maxLength={120} value={form.nome} onChange={event => setForm({ ...form, nome: event.target.value })} /></label><label>E-mail<input required type="email" maxLength={254} value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /></label><label>Perfil<select value={form.role} onChange={event => setForm({ ...form, role: event.target.value })}><option value="coord">Coordenação</option><option value="professor">Professor</option><option value="aluno">Aluno</option></select></label><label>Curso<select value={form.courseId} onChange={event => setForm({ ...form, courseId: event.target.value })}><option value="">Sem curso associado</option>{tenant.courses.map(course => <option key={course.id} value={course.id}>{course.nome}</option>)}</select></label><label>Nova senha (opcional)<input type="password" autoComplete="new-password" minLength={8} value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} /><small>Deixe vazio para manter a atual. Nova senha: 8+ caracteres, letra, número e caractere especial.</small></label></fieldset><footer><button type="button" className="ghost" disabled={saving} onClick={() => setEditing(null)}>Cancelar</button><button type="submit" className="btn primary" disabled={saving}>{saving ? 'Salvando…' : 'Salvar usuário'}</button></footer></form></div>}
  </section>;
};
