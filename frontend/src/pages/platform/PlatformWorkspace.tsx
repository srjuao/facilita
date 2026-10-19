import React, { useEffect, useState } from 'react';
import { ArrowUpRight, Headset, Plus, RefreshCw, ShieldCheck, Users } from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { TopBar } from '../../components/TopBar';
import './PlatformWorkspace.css';

type PlatformUser = { id: string; nome: string; email: string; role: string; permissions: string[]; disabledAt: string | null };
type TicketMessage = { id: string; body: string; createdAt: string; author: { nome: string; role: string } };
type Ticket = { id: string; subject: string; status: string; priority: string; createdAt: string; updatedAt: string; tenant?: { nome: string; dominio: string }; openedBy: { nome: string; email?: string }; messages: TicketMessage[] };
type Audit = { id: string; actorName: string; actorRole: string; method: string; path: string; status: number; createdAt: string };
const areas = [{ id: 'platform.support', label: 'Suporte', detail: 'Chamados das instituições' }, { id: 'platform.sales', label: 'Comercial', detail: 'Leads recebidos pelo site' }, { id: 'platform.finance', label: 'Financeiro', detail: 'Contratos e cobranças do Facilita' }];
const statusLabel: Record<string, string> = { OPEN: 'Novo', IN_PROGRESS: 'Em atendimento', WAITING_INSTITUTION: 'Aguardando instituição', RESOLVED: 'Resolvido' };
const priorityLabel: Record<string, string> = { LOW: 'Baixa', NORMAL: 'Normal', HIGH: 'Alta' };
const date = (value: string) => new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const errorText = (error: unknown) => (error as { response?: { data?: { error?: string } } }).response?.data?.error || 'Não foi possível concluir. Tente novamente.';

function Heading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <header className="platform-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>{action}</header>;
}

export function PlatformTeam() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [resetUser, setResetUser] = useState<PlatformUser | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [form, setForm] = useState({ nome: '', email: '', password: '', role: 'platform_staff', permissions: ['platform.support'] });
  async function load() { setLoading(true); setError(''); try { setUsers((await api.get<PlatformUser[]>('/platform/team')).data); } catch (failure) { setError(errorText(failure)); } finally { setLoading(false); } }
  useEffect(() => { void load(); }, []);
  async function create(event: React.FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setError(''); setSuccess('');
    try { await api.post('/platform/team', form); setForm({ nome: '', email: '', password: '', role: 'platform_staff', permissions: ['platform.support'] }); setShowCreate(false); setSuccess('Conta criada. Envie as credenciais à pessoa por um canal seguro.'); await load(); }
    catch (failure) { setError(errorText(failure)); } finally { setBusy(false); }
  }
  async function update(user: PlatformUser, changes: Record<string, unknown>) {
    if (busy) return false; setBusy(true); setError(''); setSuccess('');
    try { const changed = (await api.patch<PlatformUser>(`/platform/team/${user.id}`, changes)).data; setUsers(old => old.map(item => item.id === changed.id ? changed : item)); setSuccess('Acesso atualizado. A mudança passa a valer na próxima requisição.'); return true; }
    catch (failure) { setError(errorText(failure)); return false; } finally { setBusy(false); }
  }
  async function reset(event: React.FormEvent) {
    event.preventDefault(); if (!resetUser) return;
    if (await update(resetUser, { password: resetPassword })) { setResetUser(null); setResetPassword(''); }
  }
  return <><TopBar currentPage="Equipe da plataforma" /><div className="platform-page"><Heading eyebrow="ADMINISTRAÇÃO GERAL" title="Pessoas e acessos" description="Monte a equipe Facilita por responsabilidade. Contas de suporte, comercial e financeiro não recebem acesso irrestrito." action={<button className="primary" onClick={() => setShowCreate(value => !value)}><Plus size={17} /> Nova conta</button>} />
    {error && <p className="platform-error" role="alert">{error}</p>}{success && <p className="platform-success" role="status">{success}</p>}
    {showCreate && <form className="platform-form" onSubmit={create}><div><h2>Nova pessoa na equipe</h2><p>Escolha o perfil e as áreas antes de criar o acesso.</p></div><div className="platform-form-grid"><label>Nome<input required minLength={2} maxLength={120} value={form.nome} onChange={event => setForm({ ...form, nome: event.target.value })} /></label><label>E-mail<input type="email" required value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /></label><label>Senha inicial<input type="password" autoComplete="new-password" required minLength={8} value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} /><small>8 caracteres ou mais, com letra, número e caractere especial.</small></label><label>Perfil<select value={form.role} onChange={event => setForm({ ...form, role: event.target.value })}><option value="platform_staff">Equipe por área</option><option value="superadmin">Administrador geral · acesso total</option></select></label></div>{form.role === 'platform_staff' && <fieldset className="platform-area-options"><legend>Áreas autorizadas</legend>{areas.map(area => <label key={area.id}><input type="checkbox" checked={form.permissions.includes(area.id)} onChange={event => setForm({ ...form, permissions: event.target.checked ? [...form.permissions, area.id] : form.permissions.filter(item => item !== area.id) })} /><span><strong>{area.label}</strong><small>{area.detail}</small></span></label>)}</fieldset>}<div className="platform-actions"><button type="button" className="ghost" onClick={() => setShowCreate(false)}>Cancelar</button><button className="primary" disabled={busy}>{busy ? 'Criando…' : 'Criar acesso'}</button></div></form>}
    {resetUser && <form className="platform-form" onSubmit={reset}><h2>Redefinir senha de {resetUser.nome}</h2><p>Defina a nova senha e comunique-a por um canal seguro.</p><label>Nova senha<input type="password" autoComplete="new-password" required minLength={8} value={resetPassword} onChange={event => setResetPassword(event.target.value)} /><small>8 caracteres ou mais, com letra, número e caractere especial.</small></label><div className="platform-actions"><button className="ghost" type="button" onClick={() => setResetUser(null)}>Cancelar</button><button className="primary" disabled={busy}>Salvar nova senha</button></div></form>}
    <section className="platform-panel"><div className="platform-section-head"><div><p className="eyebrow">DIRETÓRIO INTERNO</p><h2>Contas da plataforma</h2></div><span>{users.length} pessoas</span></div>{loading ? <p role="status">Carregando equipe…</p> : users.length ? <div className="platform-table-wrap"><table><thead><tr><th>Pessoa</th><th>Responsabilidade</th><th>Situação</th><th>Ações</th></tr></thead><tbody>{users.map(user => <tr key={user.id}><td><strong>{user.nome}</strong><small>{user.email}</small></td><td>{user.role === 'superadmin' ? <span className="platform-badge owner"><ShieldCheck size={14} /> Administração geral</span> : <div className="platform-area-list">{areas.map(area => <label key={area.id}><input type="checkbox" checked={user.permissions.includes(area.id)} disabled={busy || !!user.disabledAt && !user.permissions.includes(area.id) && user.permissions.length <= 1} onChange={event => void update(user, { permissions: event.target.checked ? [...user.permissions, area.id] : user.permissions.filter(item => item !== area.id) })} />{area.label}</label>)}</div>}</td><td><span className={`platform-badge ${user.disabledAt ? 'inactive' : 'active'}`}>{user.disabledAt ? 'Desativada' : 'Ativa'}</span></td><td><button className="ghost" disabled={busy || user.id === currentUser?.id && !user.disabledAt} onClick={() => void update(user, { disabled: !user.disabledAt })}>{user.disabledAt ? 'Reativar' : 'Desativar'}</button><button className="ghost" disabled={busy} onClick={() => { setResetUser(user); setResetPassword(''); }}>Redefinir senha</button></td></tr>)}</tbody></table></div> : <div className="platform-empty"><Users size={25} /><p>Nenhuma conta da plataforma cadastrada.</p></div>}</section>
  </div></>;
}

function SupportBoard({ institution }: { institution: boolean }) {
  const endpoint = institution ? '/support-tickets' : '/platform/tickets';
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filter, setFilter] = useState('ACTIVE');
  const [createOpen, setCreateOpen] = useState(false);
  const [subject, setSubject] = useState(''); const [description, setDescription] = useState(''); const [reply, setReply] = useState('');
  async function load(quiet = false) { if (!quiet) setLoading(true); try { const result = (await api.get<Ticket[]>(endpoint)).data; setTickets(result); setError(''); } catch (failure) { if (!quiet) setError(errorText(failure)); } finally { if (!quiet) setLoading(false); } }
  useEffect(() => { void load(); const timer = window.setInterval(() => { if (!document.hidden) void load(true); }, 15000); return () => window.clearInterval(timer); }, [endpoint]);
  async function create(event: React.FormEvent) { event.preventDefault(); if (busy) return; setBusy(true); setError(''); try { await api.post(endpoint, { subject, body: description }); setSubject(''); setDescription(''); setCreateOpen(false); setSuccess('Chamado enviado à equipe Facilita.'); await load(); } catch (failure) { setError(errorText(failure)); } finally { setBusy(false); } }
  async function send(event: React.FormEvent) { event.preventDefault(); if (!selected || busy) return; setBusy(true); setError(''); try { await api.post(`${endpoint}/${selected}/reply`, { body: reply }); setReply(''); await load(true); } catch (failure) { setError(errorText(failure)); } finally { setBusy(false); } }
  async function change(field: 'status' | 'priority', value: string) { if (!selected || busy) return; setBusy(true); setError(''); try { await api.patch(`${endpoint}/${selected}`, { [field]: value }); await load(true); } catch (failure) { setError(errorText(failure)); } finally { setBusy(false); } }
  const current = tickets.find(ticket => ticket.id === selected);
  const visible = tickets.filter(ticket => filter === 'ALL' || filter === 'ACTIVE' && ticket.status !== 'RESOLVED' || filter === 'RESOLVED' && ticket.status === 'RESOLVED');
  return <><TopBar currentPage={institution ? 'Suporte Facilita' : 'Suporte às instituições'} /><div className="platform-page"><Heading eyebrow={institution ? 'ATENDIMENTO À INSTITUIÇÃO' : 'CENTRAL DE ATENDIMENTO'} title={institution ? 'Fale com o Facilita' : 'Chamados das instituições'} description={institution ? 'Abra uma solicitação, acompanhe a resposta e mantenha o histórico em um só lugar.' : 'Priorize solicitações, responda à instituição e acompanhe a resolução.'} action={institution ? <button className="primary" onClick={() => setCreateOpen(value => !value)}><Plus size={17} /> Novo chamado</button> : <button className="ghost" onClick={() => void load()}><RefreshCw size={16} /> Atualizar</button>} />
    {error && <p className="platform-error" role="alert">{error}</p>}{success && <p className="platform-success" role="status">{success}</p>}
    {createOpen && <form className="platform-form" onSubmit={create}><h2>Como podemos ajudar?</h2><label>Assunto<input required minLength={5} maxLength={160} value={subject} onChange={event => setSubject(event.target.value)} placeholder="Ex.: Acesso de professores" /></label><label>Descreva a situação<textarea required minLength={10} maxLength={4000} rows={4} value={description} onChange={event => setDescription(event.target.value)} /></label><div className="platform-actions"><button type="button" className="ghost" onClick={() => setCreateOpen(false)}>Cancelar</button><button className="primary" disabled={busy}>{busy ? 'Enviando…' : 'Enviar chamado'}</button></div></form>}
    <div className="platform-support-grid"><section className="platform-panel platform-ticket-list"><div className="platform-section-head"><h2>Solicitações</h2><span>{tickets.length}</span></div><div className="platform-filters" role="group" aria-label="Filtrar chamados"><button aria-pressed={filter === 'ACTIVE'} onClick={() => setFilter('ACTIVE')}>Em aberto</button><button aria-pressed={filter === 'RESOLVED'} onClick={() => setFilter('RESOLVED')}>Resolvidos</button><button aria-pressed={filter === 'ALL'} onClick={() => setFilter('ALL')}>Todos</button></div>{loading ? <p role="status">Carregando chamados…</p> : visible.length ? visible.map(ticket => <button key={ticket.id} className={`platform-ticket-card${selected === ticket.id ? ' selected' : ''}`} onClick={() => setSelected(ticket.id)}><span><strong>{ticket.subject}</strong><small>{ticket.tenant?.nome || ticket.openedBy.nome}</small></span><span><span className={`platform-badge ${ticket.status === 'RESOLVED' ? 'active' : 'pending'}`}>{statusLabel[ticket.status] || ticket.status}</span><small>{date(ticket.updatedAt)}</small></span></button>) : <div className="platform-empty"><Headset size={25} /><p>{filter === 'ACTIVE' ? 'Nenhum chamado em aberto.' : 'Nenhum chamado neste filtro.'}</p></div>}</section><section className="platform-panel platform-ticket-detail">{current ? <><div className="platform-section-head"><div><p className="eyebrow">{current.tenant?.nome || 'SUA INSTITUIÇÃO'}</p><h2>{current.subject}</h2><small>Aberto por {current.openedBy.nome} em {date(current.createdAt)}</small></div></div>{!institution && <div className="platform-ticket-controls"><label>Situação<select value={current.status} disabled={busy} onChange={event => void change('status', event.target.value)}>{Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Prioridade<select value={current.priority} disabled={busy} onChange={event => void change('priority', event.target.value)}>{Object.entries(priorityLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>}<div className="platform-thread" aria-label="Histórico do chamado">{current.messages.map(message => <article key={message.id} className={['superadmin', 'platform_staff'].includes(message.author.role) ? 'from-platform' : ''}><div><strong>{message.author.nome}</strong><time dateTime={message.createdAt}>{date(message.createdAt)}</time></div><p>{message.body}</p></article>)}</div><form className="platform-reply" onSubmit={send}><label>Responder<textarea required minLength={2} maxLength={4000} rows={3} value={reply} onChange={event => setReply(event.target.value)} placeholder="Escreva uma resposta para continuar o atendimento" /></label><button className="primary" disabled={busy || reply.trim().length < 2}>{busy ? 'Enviando…' : 'Enviar resposta'} <ArrowUpRight size={16} /></button></form></> : <div className="platform-empty"><Headset size={30} /><h2>Selecione um chamado</h2><p>O histórico e as respostas aparecerão aqui.</p></div>}</section></div>
  </div></>;
}
export const PlatformSupport = () => <SupportBoard institution={false} />;
export const InstitutionSupport = () => <SupportBoard institution />;

export function PlatformAudit() {
  const [logs, setLogs] = useState<Audit[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  async function load() { setLoading(true); try { setLogs((await api.get<Audit[]>('/platform/audit')).data); setError(''); } catch (failure) { setError(errorText(failure)); } finally { setLoading(false); } }
  useEffect(() => { void load(); }, []);
  return <><TopBar currentPage="Registro de ações" /><div className="platform-page"><Heading eyebrow="CONTROLE DA PLATAFORMA" title="Registro de ações" description="Histórico recente de operações realizadas pela equipe. Senhas, mensagens e dados enviados em formulários não são gravados aqui." action={<button className="ghost" onClick={() => void load()}><RefreshCw size={16} /> Atualizar</button>} />{error && <p className="platform-error" role="alert">{error}</p>}<section className="platform-panel"><div className="platform-section-head"><h2>Atividade recente</h2><span>Últimas 200 ações</span></div>{loading ? <p role="status">Carregando registros…</p> : logs.length ? <div className="platform-table-wrap"><table><thead><tr><th>Quando</th><th>Pessoa</th><th>Ação</th><th>Resultado</th></tr></thead><tbody>{logs.map(log => <tr key={log.id}><td>{date(log.createdAt)}</td><td><strong>{log.actorName}</strong><small>{log.actorRole === 'superadmin' ? 'Administração geral' : 'Equipe Facilita'}</small></td><td><code>{log.method} {log.path}</code></td><td><span className={`platform-badge ${log.status < 400 ? 'active' : 'inactive'}`}>{log.status < 400 ? 'Concluída' : `Erro ${log.status}`}</span></td></tr>)}</tbody></table></div> : <div className="platform-empty"><p>Nenhuma ação registrada ainda.</p></div>}</section></div></>;
}
