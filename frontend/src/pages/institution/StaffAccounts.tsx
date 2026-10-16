import React, { FormEvent, useEffect, useRef, useState } from 'react';
import api from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { TopBar } from '../../components/TopBar';

type Staff = { id: string; nome: string; email: string; departmentId: string | null; permissions: string[]; disabledAt: string | null };
type Department = { id: string; nome: string };
const grants = [['students.manage', 'Consultar e cadastrar alunos'], ['notices.manage', 'Publicar e administrar avisos'], ['chat.create', 'Criar conversas e grupos'], ['finance.manage', 'Gerenciar mensalidades, cobranças e baixas manuais']];
const blank = { nome: '', email: '', password: '', departmentId: '', permissions: [] as string[] };
export function StaffAccounts() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Staff[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const editor = useRef<HTMLFormElement>(null);
  useEffect(() => { if (open) { editor.current?.focus({ preventScroll: true }); editor.current?.scrollIntoView({ block: 'start' }); } }, [open, editing]);
  useEffect(() => {
    if (user?.role !== 'coord') { setStatus('ready'); return; }
    const controller = new AbortController(); setStatus('loading'); setError('');
    async function load() {
      try {
        const directory = await api.get('/institution/directory', { signal: controller.signal });
        const users: Staff[] = []; let cursor: string | null = null; const seen = new Set<string>();
        do {
          const response: { data: { users: Staff[]; nextCursor: string | null } } = await api.get('/institution-staff', { params: cursor ? { cursor } : {}, signal: controller.signal });
          users.push(...response.data.users); cursor = response.data.nextCursor;
          if (cursor && seen.has(cursor)) throw new Error('Cursor repetido');
          if (cursor) seen.add(cursor);
        } while (cursor && !controller.signal.aborted);
        if (!controller.signal.aborted) { setRows(users); setDepartments(directory.data.departments); setStatus('ready'); }
      } catch { if (!controller.signal.aborted) { setError('Não foi possível carregar os funcionários e departamentos.'); setStatus('error'); } }
    }
    void load(); return () => controller.abort();
  }, [user?.id, user?.role, retry]);
  const save = async (event: FormEvent) => {
    event.preventDefault(); if (lock.current) return; lock.current = true; setBusy(true); setError(''); setSuccess('');
    try {
      const payload = { nome: form.nome, email: form.email, departmentId: form.departmentId || null, permissions: form.permissions, ...(!editing ? { password: form.password } : {}) };
      const response = editing ? await api.patch('/institution-staff/' + encodeURIComponent(editing), payload) : await api.post('/institution-staff', payload);
      const saved = response.data.user as Staff;
      setRows(current => editing ? current.map(row => row.id === editing ? saved : row) : [...current, saved]); setForm(blank); setOpen(false); setEditing(null);
      setSuccess('Conta de funcionário salva. As permissões são independentes do nome do departamento.');
    } catch (failure: any) { setError(failure.response?.data?.error || 'Não foi possível salvar a conta. Seu formulário foi preservado.'); }
    finally { lock.current = false; setBusy(false); }
  };
  const changeStatus = async (row: Staff) => {
    if (lock.current || !window.confirm(row.disabledAt ? `Reativar a conta de ${row.nome}?` : `Desativar a conta de ${row.nome}? Ela perderá o acesso à instituição.`)) return;
    lock.current = true; setBusy(true); setError(''); setSuccess('');
    try {
      const saved = (await api.patch(`/institution-staff/${encodeURIComponent(row.id)}/status`, { active: Boolean(row.disabledAt) })).data.user as Staff;
      setRows(current => current.map(person => person.id === row.id ? saved : person)); setSuccess(saved.disabledAt ? 'Conta desativada.' : 'Conta reativada.');
    } catch (failure: any) { setError(failure.response?.data?.error || 'Não foi possível alterar o acesso.'); }
    finally { lock.current = false; setBusy(false); }
  };
  const filtered = rows.filter(row => `${row.nome} ${row.email}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')));
  if (user?.role !== 'coord') return <section className="unit-setup"><h1>Acesso restrito à coordenação</h1></section>;
  return <><TopBar currentPage="Funcionários" /><section className="unit-setup"><header className="page-head"><div><p className="eyebrow">EQUIPE DA INSTITUIÇÃO</p><h1>Funcionários e acessos</h1><p>Cadastre a equipe sem transformá-la em professor. O departamento organiza; as permissões definem o acesso.</p></div><button className="primary" disabled={busy || status !== 'ready'} onClick={() => { setForm(blank); setEditing(null); setOpen(true); }}>Novo funcionário</button></header>
    {error && <p className="inline-form-error" role="alert">{error}</p>}{success && <p className="identity-success" role="status">{success}</p>}
    {status === 'loading' ? <p role="status">Carregando equipe…</p> : status === 'error' ? <button className="ghost" onClick={() => setRetry(value => value + 1)}>Tentar novamente</button> : <>
      <section className="card"><label>Buscar funcionário<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Nome ou e-mail" /></label><div style={{ overflowX: 'auto', marginTop: 18 }}><table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}><thead><tr><th>Funcionário</th><th>Departamento</th><th>Acesso</th><th>Ações</th></tr></thead><tbody>{filtered.map(row => <tr key={row.id}><td style={{ padding: '16px 8px' }}><b>{row.nome}</b><small style={{ display: 'block' }}>{row.email}</small></td><td>{departments.find(department => department.id === row.departmentId)?.nome || 'Sem departamento ativo'}</td><td>{row.disabledAt ? 'Desativado' : 'Ativo'}</td><td><div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}><button className="ghost" disabled={busy} onClick={() => { setEditing(row.id); setForm({ nome: row.nome, email: row.email, password: '', departmentId: departments.some(department => department.id === row.departmentId) ? row.departmentId || '' : '', permissions: row.permissions }); setOpen(true); }}>Editar<span className="iw-sr-only"> {row.nome}</span></button><button className="ghost" disabled={busy} onClick={() => void changeStatus(row)}>{row.disabledAt ? 'Reativar' : 'Desativar'}<span className="iw-sr-only"> {row.nome}</span></button></div></td></tr>)}</tbody></table></div>{!filtered.length && <p className="muted">Nenhum funcionário encontrado. Cadastros novos começam sem permissões.</p>}</section>
      {open && <form ref={editor} tabIndex={-1} className="card compact-form" style={{ marginTop: 24, padding: 24 }} onSubmit={save}><h2>{editing ? 'Editar funcionário' : 'Nova conta de funcionário'}</h2><fieldset disabled={busy} style={{ border: 0, padding: 0, display: 'grid', gap: 14 }}><label>Nome completo<input required minLength={2} maxLength={120} autoComplete="name" value={form.nome} onChange={event => setForm({ ...form, nome: event.target.value })} /></label><label>E-mail de acesso<input required type="email" maxLength={254} autoComplete="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /></label>{!editing && <label>Senha de acesso<input required type="password" minLength={8} autoComplete="new-password" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} /><small>Ao menos 8 caracteres, com letra, número e caractere especial.</small></label>}<label>Departamento<select value={form.departmentId} onChange={event => setForm({ ...form, departmentId: event.target.value })}><option value="">Sem departamento</option>{departments.map(department => <option key={department.id} value={department.id}>{department.nome}</option>)}</select></label><fieldset><legend>Permissões</legend>{grants.map(([key, label]) => <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8 }}><input type="checkbox" style={{ width: 'auto' }} checked={form.permissions.includes(key)} onChange={event => setForm({ ...form, permissions: event.target.checked ? [...form.permissions, key] : form.permissions.filter(value => value !== key) })} />{label}</label>)}</fieldset><p className="muted">A permissão financeira permite configurar mensalidades, emitir faturas e registrar baixas da própria instituição. A conta não recebe poderes de coordenação.</p><div style={{ display: 'flex', gap: 10 }}><button type="button" className="ghost" onClick={() => { setOpen(false); setForm(blank); }}>{'Cancelar'}</button><button className="primary">{busy ? 'Salvando…' : 'Salvar funcionário'}</button></div></fieldset></form>}
    </>}
  </section></>;
}
