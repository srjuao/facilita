import React, { useEffect, useRef, useState } from 'react';
import { Bell, Building2, MessageCircle, Plus, Users } from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { TopBar } from '../../components/TopBar';
import './InstitutionWorkspace.css';
import { AppDialog } from '../../components/AppDialog';

type Section = 'notices' | 'classes' | 'team' | 'chat';
type Person = { id: string; nome: string; email?: string; role: string; departmentId?: string | null; permissions?: string[]; courseId?: string | null };
type Directory = { users: Person[]; departments: Department[]; courses: { id: string; nome: string }[] };
type DirectoryPage = Directory & { nextCursor: string | null; totalUsers: number };
async function loadDirectory(signal: AbortSignal): Promise<Directory> {
  const users = new Map<string, Person>();
  const seenCursors = new Set<string>();
  let cursor: string | null = null;
  let metadata: Omit<Directory, 'users'>;
  do {
    const response: { data: DirectoryPage } = await api.get<DirectoryPage>('/institution/directory', { signal, params: cursor ? { cursor } : undefined });
    if (signal.aborted) throw new Error('Leitura cancelada.');
    response.data.users.forEach(person => users.set(person.id, person));
    metadata = { departments: response.data.departments, courses: response.data.courses };
    cursor = response.data.nextCursor;
    if (cursor && seenCursors.has(cursor)) throw new Error('Não foi possível concluir a leitura das pessoas.');
    if (cursor) seenCursors.add(cursor);
  } while (cursor);
  return { ...metadata, users: [...users.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')) };
}
type ManagedRecord = { updatedAt: string; archivedAt: string | null };
type Department = ManagedRecord & { id: string; nome: string };
type Notice = ManagedRecord & { id: string; title: string; body: string; createdAt: string; author?: { nome: string } };
type ClassRoom = ManagedRecord & { id: string; nome: string; courseId: string; periodId: string | null; course?: { id: string; nome: string }; period?: { id: string; nome: string } | null; memberIds: string[] };
type ClassPeriod = { id: string; nome: string; courseId: string; archivedAt: string | null };
type Conversation = ManagedRecord & { id: string; nome: string; memberIds: string[]; createdAt: string };
async function loadConversations(signal: AbortSignal): Promise<Conversation[]> {
  const rooms = new Map<string, Conversation>();
  const seenCursors = new Set<string>();
  let cursor: string | null = null;
  do {
    const response: { data: { items: Conversation[]; nextCursor: string | null } } = await api.get('/institution/conversations', { signal, params: cursor ? { cursor } : undefined });
    if (signal.aborted) throw new Error('Leitura cancelada.');
    response.data.items.forEach(room => rooms.set(room.id, room));
    cursor = response.data.nextCursor;
    if (cursor && seenCursors.has(cursor)) throw new Error('Não foi possível concluir a leitura das conversas.');
    if (cursor) seenCursors.add(cursor);
  } while (cursor);
  return [...rooms.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
}
type Message = { id: string; body: string; sender: { id: string; nome: string }; createdAt: string };
const descriptions = {
  notices: ['Avisos da instituição', 'Comunicados publicados pela equipe para a comunidade acadêmica.'],
  classes: ['Turmas', 'Vincule cada turma a um curso e período, depois escolha seus participantes.'],
  team: ['Equipe e departamentos', 'Organize as pessoas e defina o que cada professor pode gerenciar.'],
  chat: ['Conversas', 'Um espaço da instituição para conversas individuais e em grupo.'],
};
const roleName: Record<string, string> = { coord: 'Coordenação', professor: 'Professor', aluno: 'Aluno', superadmin: 'Superadmin', staff: 'Funcionário' };
const permissionOptions = [
  ['live.manage', 'Agendar e conduzir aulas ao vivo'],
  ['content.manage', 'Períodos, matérias e conteúdo do curso'],
  ['exams.manage', 'Gerenciar provas e atividades'],
  ['students.manage', 'Cadastro de alunos'],
  ['notices.manage', 'Publicação de avisos'],
  ['classes.manage', 'Gestão de turmas'],
  ['chat.create', 'Criação de conversas e grupos'],
];
function errorText(error: unknown, fallback: string) {
  const data = (error as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
  return data?.error || data?.message || fallback;
}
function dateText(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}
function Empty({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="iw-empty"><h2>{title}</h2><p>{children}</p></div>;
}
function Feedback({ error, success }: { error?: string; success?: string }) {
  return <>{error && <p className="iw-feedback iw-error" role="alert">{error}</p>}{success && <p className="iw-feedback iw-success" role="status">{success}</p>}</>;
}
function MemberPicker({ users, selected, onChange, label = 'Participantes', limit = 500 }: { users: Person[]; selected: string[]; onChange: (ids: string[]) => void; label?: string; limit?: number }) {
  const [search, setSearch] = useState('');
  const filtered = users.filter(person => `${person.nome} ${person.email || ''}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  return <fieldset className="iw-members"><legend>{label} · {selected.length} de {limit} selecionados</legend><input type="search" aria-label="Buscar participantes" placeholder="Buscar por nome ou e-mail" value={search} onChange={event => setSearch(event.target.value)} /><div className="iw-member-options">{filtered.length ? filtered.map(person => <label key={person.id}><input type="checkbox" disabled={!selected.includes(person.id) && selected.length >= limit} checked={selected.includes(person.id)} onChange={event => onChange(event.target.checked && selected.length < limit ? [...selected, person.id] : selected.filter(id => id !== person.id))} /><span>{person.nome}<small>{roleName[person.role] || person.role}{person.email ? ` · ${person.email}` : ''}</small></span></label>) : <p className="muted">Nenhum participante encontrado.</p>}</div></fieldset>;
}

export function InstitutionWorkspace({ section }: { section: Section }) {
  return <Workspace key={section} section={section} />;
}
function Workspace({ section }: { section: Section }) {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [directory, setDirectory] = useState<Directory>({ users: [], departments: [], courses: [] });
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const coord = user?.role === 'coord';
  const can = (permission: string) => coord || permissions.includes(permission);
  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading'); setError('');
    async function load() {
      try {
        const access = await api.get<{ permissions: string[] }>('/institution/access', { signal: controller.signal });
        if (controller.signal.aborted) return;
        setPermissions(access.data.permissions);
        const grants = access.data.permissions;
        const needsDirectory = (section === 'team' && coord) || (section === 'classes' && (coord || grants.includes('classes.manage'))) || (section === 'chat' && (coord || grants.includes('chat.create')));
        if (needsDirectory) {
          const directory = await loadDirectory(controller.signal);
          if (controller.signal.aborted) return;
          setDirectory(section === 'classes' && !coord ? { ...directory, courses: directory.courses.filter(course => course.id === user?.courseId) } : directory);
        }
        setStatus('ready');
      } catch (failure) {
        if (!controller.signal.aborted) { setError(errorText(failure, 'Não foi possível carregar este espaço.')); setStatus('error'); }
      }
    }
    void load();
    return () => controller.abort();
  }, [section, coord, user?.id, user?.courseId, retry]);
  const [title, description] = descriptions[section];
  return <><TopBar currentPage={title} /><div className="institution-workspace"><header className="iw-heading"><div><p className="eyebrow">COMUNIDADE ACADÊMICA</p><h1>{title}</h1><p>{description}</p></div><span className="iw-context">{section === 'notices' ? <Bell size={20} /> : section === 'classes' ? <Users size={20} /> : section === 'team' ? <Building2 size={20} /> : <MessageCircle size={20} />}<span>{user?.tenant?.nome || 'Sua instituição'}</span></span></header>
    {status === 'loading' ? <p className="iw-loading" role="status">Carregando {title.toLocaleLowerCase()}…</p> : status === 'error' ? <div className="iw-panel"><Feedback error={error} /><button className="btn" onClick={() => setRetry(value => value + 1)}>Tentar novamente</button></div> : <>
      {section === 'notices' && <Notices canManage={can('notices.manage')} />}
      {section === 'classes' && <Classes canManage={can('classes.manage')} directory={directory} />}
      {section === 'team' && (coord ? <Team directory={directory} onDirectory={setDirectory} /> : <Empty title="Acesso restrito à coordenação">A coordenação da instituição administra os departamentos e as permissões da equipe.</Empty>)}
      {section === 'chat' && <Chat canCreate={can('chat.create')} directory={directory} userId={user?.id || ''} />}
    </>}
  </div></>;
}

function ArchiveTabs({ archived, onChange, disabled }: { archived: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return <div className="iw-archive-tabs" role="group" aria-label="Estado dos registros"><button className={!archived ? 'is-selected' : ''} aria-pressed={!archived} disabled={disabled} onClick={() => onChange(false)}>Ativos</button><button className={archived ? 'is-selected' : ''} aria-pressed={archived} disabled={disabled} onClick={() => onChange(true)}>Arquivados</button></div>;
}
function Notices({ canManage }: { canManage: boolean }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true), [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0), [archived, setArchived] = useState(false);
  const [open, setOpen] = useState(false), [editing, setEditing] = useState<Notice | null>(null);
  const [title, setTitle] = useState(''), [body, setBody] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState('');
  const lock = useRef(false);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setLoadError('');
    api.get<Notice[]>('/institution/notices', { signal: controller.signal, params: { archived: canManage && archived } }).then(response => { if (!controller.signal.aborted) setNotices(response.data); }).catch(failure => { if (!controller.signal.aborted) setLoadError(errorText(failure, 'Não foi possível carregar os avisos.')); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [retry, archived, canManage]);
  async function publish(event: React.FormEvent) {
    event.preventDefault(); if (lock.current) return; lock.current = true; setBusy(true); setError(''); setSuccess('');
    try {
      const data = { title: title.trim(), body: body.trim(), ...(editing ? { expectedUpdatedAt: editing.updatedAt } : {}) };
      if (editing) await api.patch('/institution/notices/' + encodeURIComponent(editing.id), data);
      else await api.post('/institution/notices', data);
      setTitle(''); setBody(''); setOpen(false); setEditing(null); setRetry(value => value + 1); setSuccess(editing ? 'Aviso atualizado.' : 'Aviso publicado para a instituição.');
    } catch (failure) { setError(errorText(failure, 'Não foi possível salvar. Seu texto foi preservado.')); }
    finally { lock.current = false; setBusy(false); }
  }
  async function archive(notice: Notice) {
    if (lock.current) return; lock.current = true; setBusy(true); setError(''); setSuccess('');
    try { await api.patch('/institution/notices/' + encodeURIComponent(notice.id), { title: notice.title, body: notice.body, archived: !notice.archivedAt, expectedUpdatedAt: notice.updatedAt }); setRetry(value => value + 1); setSuccess(notice.archivedAt ? 'Aviso restaurado.' : 'Aviso arquivado. O texto foi preservado.'); }
    catch (failure) { setError(errorText(failure, 'Não foi possível alterar o aviso.')); }
    finally { lock.current = false; setBusy(false); }
  }
  return <><div className="iw-toolbar">{canManage ? <ArchiveTabs archived={archived} disabled={busy} onChange={value => { setArchived(value); setOpen(false); }} /> : <p>Comunicados da equipe</p>}{canManage && <button className="btn primary" disabled={busy} aria-expanded={open} onClick={() => { setEditing(null); setTitle(''); setBody(''); setError(''); setOpen(true); }}><Plus size={17} />Publicar aviso</button>}</div><Feedback error={error} success={success} />
    {open && <AppDialog title={editing ? 'Editar comunicado' : 'Novo comunicado'} eyebrow="AVISOS" description="Compartilhe uma mensagem com a comunidade da instituição." busy={busy} onClose={() => setOpen(false)}><form className="iw-form" onSubmit={publish}><Feedback error={error} /><label>Título<input required maxLength={160} value={title} onChange={event => setTitle(event.target.value)} disabled={busy} /></label><label>Mensagem<textarea required maxLength={10000} rows={5} value={body} onChange={event => setBody(event.target.value)} disabled={busy} /></label><div className="iw-actions"><button className="btn" type="button" disabled={busy} onClick={() => setOpen(false)}>Cancelar</button><button className="btn primary" disabled={busy || !title.trim() || !body.trim()}>{busy ? 'Salvando…' : editing ? 'Salvar aviso' : 'Publicar aviso'}</button></div></form></AppDialog>}
    {loading ? <p role="status">Carregando avisos…</p> : loadError ? <div className="iw-panel"><Feedback error={loadError} /><button className="btn" onClick={() => setRetry(value => value + 1)}>Tentar novamente</button></div> : notices.length ? <div className="iw-notices">{notices.map(notice => <article className="iw-notice" key={notice.id}><div className="iw-notice-icon"><Bell size={20} /></div><div className="iw-record-body"><p className="iw-meta">{notice.author?.nome || 'Equipe da instituição'} · <time dateTime={notice.createdAt}>{dateText(notice.createdAt)}</time></p><h2>{notice.title}</h2><p className="iw-plain">{notice.body}</p>{canManage && <div className="iw-record-actions"><button className="btn" disabled={busy} onClick={() => { setEditing(notice); setTitle(notice.title); setBody(notice.body); setError(''); setOpen(true); }}>Editar<span className="iw-sr-only"> {notice.title}</span></button><button className="btn" disabled={busy} onClick={() => void archive(notice)}>{notice.archivedAt ? 'Restaurar' : 'Arquivar'}<span className="iw-sr-only"> {notice.title}</span></button></div>}</div></article>)}</div> : <Empty title={archived ? 'Nenhum aviso arquivado' : 'Nenhum aviso publicado'}>{canManage ? 'Os comunicados da instituição ficam organizados aqui. Arquivar preserva o texto e permite restaurar depois.' : 'Os comunicados da instituição aparecerão aqui quando forem publicados.'}</Empty>}
  </>;
}

function Classes({ canManage, directory }: { canManage: boolean; directory: Directory }) {
  const [step, setStep] = useState(0);
  const [classes, setClasses] = useState<ClassRoom[]>([]), [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(''), [retry, setRetry] = useState(0), [archived, setArchived] = useState(false);
  const [open, setOpen] = useState(false), [editing, setEditing] = useState<ClassRoom | null>(null);
  const [nome, setNome] = useState(''), [courseId, setCourseId] = useState(''), [periodId, setPeriodId] = useState(''), [periods, setPeriods] = useState<ClassPeriod[]>([]), [periodsLoading, setPeriodsLoading] = useState(false), [periodsError, setPeriodsError] = useState(''), [members, setMembers] = useState<string[]>([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState('');
  const lock = useRef(false);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setLoadError('');
    api.get<ClassRoom[]>('/institution/classes', { signal: controller.signal, params: { archived: canManage && archived } }).then(response => { if (!controller.signal.aborted) setClasses(response.data); }).catch(failure => { if (!controller.signal.aborted) setLoadError(errorText(failure, 'Não foi possível carregar as turmas.')); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [retry, archived, canManage]);
  useEffect(() => {
    if (!open || !courseId) { setPeriods([]); setPeriodsError(''); setPeriodsLoading(false); return; }
    const controller = new AbortController();
    setPeriodsLoading(true); setPeriodsError('');
    api.get<ClassPeriod[]>('/institution/periods', { signal: controller.signal, params: { courseId } })
      .then(response => { if (!controller.signal.aborted) setPeriods(response.data.filter(period => period.courseId === courseId && !period.archivedAt)); })
      .catch(failure => { if (!controller.signal.aborted) { setPeriods([]); setPeriodsError(errorText(failure, 'Não foi possível carregar os períodos deste curso.')); } })
      .finally(() => { if (!controller.signal.aborted) setPeriodsLoading(false); });
    return () => controller.abort();
  }, [open, courseId, retry]);
  const eligible = directory.users.filter(person => person.courseId === courseId && ['aluno', 'professor'].includes(person.role));
  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (step === 0) { setStep(1); return; }
    if (lock.current) return; lock.current = true; setBusy(true); setError(''); setSuccess('');
    try {
      const data = { nome: nome.trim(), courseId, periodId, memberIds: members, ...(editing ? { expectedUpdatedAt: editing.updatedAt } : {}) };
      if (editing) await api.patch('/institution/classes/' + encodeURIComponent(editing.id), data); else await api.post('/institution/classes', data);
      setNome(''); setCourseId(''); setPeriodId(''); setMembers([]); setOpen(false); setEditing(null); setRetry(value => value + 1); setSuccess(editing ? 'Turma atualizada.' : 'Turma criada.');
    } catch (failure) { setError(errorText(failure, 'Não foi possível salvar a turma.')); }
    finally { lock.current = false; setBusy(false); }
  }
  async function archive(room: ClassRoom) {
    if (lock.current) return; lock.current = true; setBusy(true); setError(''); setSuccess('');
    try { await api.patch('/institution/classes/' + encodeURIComponent(room.id), { nome: room.nome, memberIds: room.memberIds, archived: !room.archivedAt, expectedUpdatedAt: room.updatedAt }); setRetry(value => value + 1); setSuccess(room.archivedAt ? 'Turma restaurada.' : 'Turma arquivada. Os participantes foram preservados.'); }
    catch (failure) { setError(errorText(failure, 'Não foi possível alterar a turma.')); }
    finally { lock.current = false; setBusy(false); }
  }
  return <>
    <div className="iw-toolbar">{canManage ? <ArchiveTabs archived={archived} disabled={busy} onChange={value => { setArchived(value); setOpen(false); }} /> : <p>{classes.length} turmas disponíveis</p>}{canManage && <button className="btn primary" disabled={busy} aria-expanded={open} onClick={() => { setEditing(null); setNome(''); setCourseId(''); setPeriodId(''); setMembers([]); setStep(0); setError(''); setOpen(true); }}><Plus size={17} />Nova turma</button>}</div>
    <Feedback error={error} success={success} />
    {open && <AppDialog title={editing ? 'Editar turma' : 'Nova turma'} eyebrow="TURMAS" description="Escolha o curso e o período, depois adicione os participantes." wide busy={busy} focusKey={step} onClose={() => { setOpen(false); setStep(0); }}><ol className="iw-flow-steps" aria-label="Etapas da turma"><li aria-current={step === 0 ? 'step' : undefined}><span>1</span>Curso e período</li><li aria-current={step === 1 ? 'step' : undefined}><span>2</span>Participantes</li></ol><form className="iw-form" onSubmit={create}><Feedback error={error} />
      {step === 0 ? <>
      {!directory.courses.length && <p className="iw-feedback">Crie um curso em Cursos e estrutura antes de cadastrar uma turma.</p>}
      <div className="iw-fields">
        <label>Nome da turma<input required maxLength={100} disabled={busy} value={nome} onChange={event => setNome(event.target.value)} /></label>
        <label>Curso<select required disabled={busy || !!editing} value={courseId} onChange={event => { setCourseId(event.target.value); setPeriodId(''); setMembers([]); }}><option value="">Selecione um curso</option>{directory.courses.map(course => <option value={course.id} key={course.id}>{course.nome}</option>)}</select></label>
        <label>Período<select required disabled={busy || !courseId || periodsLoading} value={periodId} onChange={event => setPeriodId(event.target.value)}><option value="">{periodsLoading ? 'Carregando períodos…' : 'Selecione um período'}</option>{periods.map(period => <option value={period.id} key={period.id}>{period.nome}</option>)}</select></label>
      </div>
      {periodsError && <Feedback error={periodsError} />}
      {courseId && !periodsLoading && !periodsError && !periods.length && <p className="iw-feedback">Este curso ainda não tem período ativo. Cadastre um período em Cursos e estrutura antes de criar a turma.</p>}
      </> : <><div className="iw-person-summary"><Users size={20} /><div><strong>{nome}</strong><small>{directory.courses.find(course => course.id === courseId)?.nome} · {periods.find(period => period.id === periodId)?.nome}</small></div></div><fieldset disabled={busy || !courseId || !periodId} className="iw-reset-fieldset"><MemberPicker users={eligible} selected={members} onChange={setMembers} /></fieldset><p className="iw-footnote">Você pode criar a turma agora e adicionar participantes depois.</p></>}
      <div className="iw-actions"><button className="btn" type="button" disabled={busy} onClick={() => { if (step) setStep(0); else setOpen(false); }}>{step ? 'Voltar' : 'Cancelar'}</button><button className="btn primary" disabled={busy || !courseId || !periodId || !nome.trim() || periodsLoading || !!periodsError}>{busy ? 'Salvando…' : step === 0 ? 'Continuar' : editing ? 'Salvar turma' : 'Criar turma'}</button></div>
    </form></AppDialog>}
    {loading ? <p role="status">Carregando turmas…</p> : loadError ? <div className="iw-panel"><Feedback error={loadError} /><button className="btn" onClick={() => setRetry(value => value + 1)}>Tentar novamente</button></div> : classes.length ? <div className="iw-class-list">{classes.map(room => <article className="iw-panel iw-class" key={room.id}><Users size={22} /><div><h2>{room.nome}</h2><p>{room.course?.nome || directory.courses.find(course => course.id === room.courseId)?.nome || 'Curso da instituição'} · {room.period?.nome || 'Período ainda não vinculado'}</p><span className="iw-count">{room.memberIds.length} participantes</span>{canManage && <div className="iw-record-actions"><button className="btn" disabled={busy} onClick={() => { setEditing(room); setNome(room.nome); setCourseId(room.courseId); setPeriodId(room.periodId || ''); setMembers(room.memberIds); setStep(0); setError(''); setOpen(true); }}>Editar<span className="iw-sr-only"> {room.nome}</span></button><button className="btn" disabled={busy} onClick={() => void archive(room)}>{room.archivedAt ? 'Restaurar' : 'Arquivar'}<span className="iw-sr-only"> {room.nome}</span></button></div>}</div></article>)}</div> : <Empty title={archived ? 'Nenhuma turma arquivada' : 'Nenhuma turma disponível'}>{canManage ? 'Crie uma turma em um curso e período. Arquivar não apaga os registros.' : 'As turmas às quais você pertence aparecerão aqui.'}</Empty>}
  </>;
}

function Departments({ directory, onDirectory }: { directory: Directory; onDirectory: (value: Directory) => void }) {
  const [items, setItems] = useState<Department[]>([]), [archived, setArchived] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null), [nome, setNome] = useState(''), [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [retry, setRetry] = useState(0);
  const [error, setError] = useState(''), [success, setSuccess] = useState('');
  const lock = useRef(false);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    api.get<Department[]>('/institution/departments', { signal: controller.signal, params: { archived } }).then(response => { if (!controller.signal.aborted) setItems(response.data); }).catch(failure => { if (!controller.signal.aborted) setError(errorText(failure, 'Não foi possível carregar os departamentos.')); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [archived, retry]);
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (lock.current) return; lock.current = true; setBusy(true); setError(''); setSuccess('');
    try {
      const response = editing ? await api.patch<Department>('/institution/departments/' + encodeURIComponent(editing.id), { nome: nome.trim(), expectedUpdatedAt: editing.updatedAt }) : await api.post<Department>('/institution/departments', { nome: nome.trim() });
      if (!response.data.archivedAt) onDirectory({ ...directory, departments: [...directory.departments.filter(item => item.id !== response.data.id), response.data] });
      setEditing(null); setNome(''); setRetry(value => value + 1); setSuccess('Departamento salvo.'); setOpen(false);
    } catch (failure) { setError(errorText(failure, 'Não foi possível salvar o departamento.')); }
    finally { lock.current = false; setBusy(false); }
  }
  async function archive(item: Department) {
    if (lock.current) return; lock.current = true; setBusy(true); setError(''); setSuccess('');
    try {
      const response = await api.patch<Department>('/institution/departments/' + encodeURIComponent(item.id), { nome: item.nome, expectedUpdatedAt: item.updatedAt, archived: !item.archivedAt });
      onDirectory({ ...directory, departments: response.data.archivedAt ? directory.departments.filter(department => department.id !== item.id) : [...directory.departments.filter(department => department.id !== item.id), response.data] });
      setEditing(null); setNome(''); setRetry(value => value + 1); setSuccess(item.archivedAt ? 'Departamento restaurado.' : 'Departamento arquivado. Os vínculos existentes foram preservados.');
    } catch (failure) { setError(errorText(failure, 'Não foi possível alterar o departamento.')); }
    finally { lock.current = false; setBusy(false); }
  }
  return <section className="iw-panel"><div className="iw-toolbar"><div><h2>Departamentos</h2><p className="muted">Organização interna da instituição.</p></div><button className="btn primary" disabled={busy} onClick={() => { setEditing(null); setNome(''); setError(''); setOpen(true); }}><Plus size={16} /><span className="iw-sr-only">Novo departamento</span></button></div><ArchiveTabs archived={archived} disabled={busy} onChange={value => { setArchived(value); setEditing(null); setNome(''); }} /><Feedback error={error} success={success} />
    {loading ? <p role="status">Carregando departamentos…</p> : items.length ? <ul className="iw-departments">{items.map(item => <li key={item.id}><Building2 size={16} /><div><strong>{item.nome}</strong><div className="iw-record-actions"><button className="btn" disabled={busy} onClick={() => { setEditing(item); setNome(item.nome); setError(''); setOpen(true); }}>Editar<span className="iw-sr-only"> {item.nome}</span></button><button className="btn" disabled={busy} onClick={() => void archive(item)}>{item.archivedAt ? 'Restaurar' : 'Arquivar'}<span className="iw-sr-only"> {item.nome}</span></button></div></div></li>)}</ul> : <p className="muted">Nenhum departamento {archived ? 'arquivado' : 'ativo'}.</p>}
    {error && <button className="btn" onClick={() => setRetry(value => value + 1)}>Atualizar lista</button>}
    {open && <AppDialog title={editing ? 'Editar departamento' : 'Novo departamento'} eyebrow="ORGANIZAÇÃO" busy={busy} onClose={() => setOpen(false)}><form className="iw-form" onSubmit={save}><Feedback error={error} /><label>{editing ? 'Editar departamento' : 'Novo departamento'}<input required maxLength={100} disabled={busy} value={nome} onChange={event => setNome(event.target.value)} placeholder="Ex.: Secretaria" /></label><div className="iw-actions"><button className="btn" type="button" disabled={busy} onClick={() => setOpen(false)}>Cancelar</button><button className="btn" disabled={busy || !nome.trim()}>{busy ? 'Salvando…' : editing ? 'Salvar' : 'Criar departamento'}</button></div></form></AppDialog>}<p className="iw-footnote">Arquivar preserva pessoas e histórico. Novos vínculos só podem usar departamentos ativos; permissões são definidas por pessoa.</p></section>;
}

function Team({ directory, onDirectory }: { directory: Directory; onDirectory: (value: Directory) => void }) {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Person | null>(null); const [permissions, setPermissions] = useState<string[]>([]); const [departmentId, setDepartmentId] = useState('');
  const [busy, setBusy] = useState(false); const lock = useRef(false); const [error, setError] = useState(''); const [success, setSuccess] = useState('');
  async function saveAccess(event: React.FormEvent) {
    event.preventDefault(); if (lock.current || !editing) return; lock.current = true; setBusy(true); setError(''); setSuccess('');
    try {
      await api.patch(`/institution/users/${encodeURIComponent(editing.id)}/access`, { permissions: editing.role === 'professor' ? permissions : [], departmentId: departmentId || null });
      onDirectory({ ...directory, users: directory.users.map(person => person.id === editing.id ? { ...person, departmentId: departmentId || null, permissions: editing.role === 'professor' ? permissions : [] } : person) }); setEditing(null); setSuccess('Acesso atualizado. As permissões são verificadas também no servidor.');
    } catch (failure) { setError(errorText(failure, 'Não foi possível salvar as permissões.')); }
    finally { lock.current = false; setBusy(false); }
  }
  const filtered = directory.users.filter(person => `${person.nome} ${person.email || ''}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  return <><Feedback error={error} success={success} /><div className="iw-team-layout"><Departments directory={directory} onDirectory={onDirectory} /><section className="iw-panel"><div className="iw-toolbar"><h2>Pessoas da instituição</h2><span className="iw-count">{directory.users.length}</span></div><input type="search" aria-label="Buscar pessoas da instituição" placeholder="Buscar nome ou e-mail" value={search} onChange={event => setSearch(event.target.value)} />{filtered.length ? <ul className="iw-people">{filtered.map(person => <li key={person.id}><div><strong>{person.nome}</strong><span>{person.email}</span><small>{roleName[person.role] || person.role} · {directory.departments.find(department => department.id === person.departmentId)?.nome || 'Sem departamento'}</small></div>{(person.role === 'professor' || person.role === 'aluno') && <button className="btn" disabled={busy} onClick={() => { setEditing(person); setPermissions(person.permissions || []); setDepartmentId(person.departmentId || ''); setError(''); }}>Editar acesso<span className="iw-sr-only"> de {person.nome}</span></button>}</li>)}</ul> : <Empty title="Nenhuma pessoa encontrada">Cadastre ou vincule pessoas à instituição para organizar a equipe.</Empty>}</section></div>
    {editing && <AppDialog title={editing.nome} eyebrow="EDITAR ACESSO" description="Organize o departamento e as permissões desta pessoa." busy={busy} onClose={() => setEditing(null)}><form className="iw-form" onSubmit={saveAccess}><Feedback error={error} /><label>Departamento<select disabled={busy} value={departmentId} onChange={event => setDepartmentId(event.target.value)}><option value="">Sem departamento</option>{departmentId && !directory.departments.some(item => item.id === departmentId) && <option value={departmentId}>Departamento arquivado (vínculo atual)</option>}{directory.departments.map(department => <option key={department.id} value={department.id}>{department.nome}</option>)}</select></label>{editing.role === 'professor' ? <fieldset className="iw-grants" disabled={busy}><legend>Permissões do professor</legend><p>Sem uma permissão marcada, o professor não pode gerenciar essa área.</p>{permissionOptions.map(([key, label]) => <label key={key}><input type="checkbox" checked={permissions.includes(key)} onChange={event => setPermissions(event.target.checked ? [...permissions, key] : permissions.filter(value => value !== key))} />{label}</label>)}</fieldset> : <p className="iw-feedback">Alunos podem visualizar conteúdo e avisos, assistir às aulas e realizar atividades. Não recebem permissões administrativas.</p>}<div className="iw-actions"><button type="button" className="btn" disabled={busy} onClick={() => setEditing(null)}>Cancelar</button><button className="btn primary" disabled={busy}>{busy ? 'Salvando…' : 'Salvar acesso'}</button></div></form></AppDialog>}
  </>;
}

function Chat({ canCreate, directory, userId }: { canCreate: boolean; directory: Directory; userId: string }) {
  const [rooms, setRooms] = useState<Conversation[]>([]); const [selected, setSelected] = useState(''); const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true); const [messageLoading, setMessageLoading] = useState(false); const [loadError, setLoadError] = useState(''); const [messageError, setMessageError] = useState('');
  const [retry, setRetry] = useState(0); const [messageRetry, setMessageRetry] = useState(0);
  const [creating, setCreating] = useState(false); const [editingRoom, setEditingRoom] = useState<Conversation | null>(null); const [nome, setNome] = useState(''); const [members, setMembers] = useState<string[]>([]); const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false); const lock = useRef(false); const selectedRef = useRef(selected); selectedRef.current = selected;
  const [error, setError] = useState(''); const [success, setSuccess] = useState('');
  const messageList = useRef<HTMLDivElement>(null); const scrollToLatest = useRef(true);
  const roomVersion = useRef(0); const [roomRefreshError, setRoomRefreshError] = useState('');
  useEffect(() => {
    const list = messageList.current;
    if (list && scrollToLatest.current) list.scrollTop = list.scrollHeight;
  }, [messages]);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setLoadError('');
    let inFlight = false; let initial = true;
    async function loadRooms() {
      if (inFlight || document.hidden || controller.signal.aborted) return;
      inFlight = true; const version = roomVersion.current;
      try {
        const conversations = await loadConversations(controller.signal);
        if (!controller.signal.aborted && version === roomVersion.current) {
          setRooms(conversations); setLoadError(''); setRoomRefreshError('');
          if (selectedRef.current && !conversations.some(room => room.id === selectedRef.current)) setSelected('');
        }
      } catch (failure) {
        if (!controller.signal.aborted) {
          const text = errorText(failure, 'Não foi possível atualizar as conversas.');
          if (initial) setLoadError(text); else setRoomRefreshError(text);
        }
      } finally { inFlight = false; if (!controller.signal.aborted) setLoading(false); initial = false; }
    }
    const visible = () => { if (!document.hidden) void loadRooms(); };
    void loadRooms(); const timer = window.setInterval(() => void loadRooms(), 5000); document.addEventListener('visibilitychange', visible);
    return () => { controller.abort(); window.clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  }, [retry]);
  useEffect(() => {
    if (!selected) { setMessages([]); return; }
    const controller = new AbortController(); let inFlight = false; let first = true; let mutationVersion = 0;
    scrollToLatest.current = true; setMessages([]); setMessageError(''); setMessageLoading(true);
    async function load() {
      if (inFlight || document.hidden || controller.signal.aborted) return;
      inFlight = true; const version = mutationVersion;
      try {
        const response = await api.get<Message[]>(`/institution/conversations/${encodeURIComponent(selected)}/messages`, { signal: controller.signal });
        if (!controller.signal.aborted && selectedRef.current === selected && version === mutationVersion) {
          setMessages(current => {
            const merged = new Map(response.data.map(message => [message.id, message]));
            current.forEach(message => { if (!merged.has(message.id)) merged.set(message.id, message); });
            return [...merged.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)).slice(-100);
          }); setMessageError('');
        }
      } catch (failure) { if (!controller.signal.aborted && selectedRef.current === selected) { const code = (failure as { response?: { status?: number } }).response?.status; if (code === 403 || code === 404) setMessages([]); setMessageError(errorText(failure, 'Não foi possível atualizar as mensagens.')); } }
      finally { inFlight = false; if (!controller.signal.aborted) { if (first) setMessageLoading(false); first = false; } }
    }
    const visible = () => { if (!document.hidden) void load(); };
    void load(); const timer = window.setInterval(() => void load(), 3000); document.addEventListener('visibilitychange', visible);
    return () => { mutationVersion++; controller.abort(); window.clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  }, [selected, messageRetry]);
  async function create(event: React.FormEvent) {
    event.preventDefault(); if (lock.current) return; lock.current = true; setBusy(true); setError(''); setSuccess('');
    roomVersion.current++;
    try { const data = { nome: nome.trim(), memberIds: members, ...(editingRoom ? { expectedUpdatedAt: editingRoom.updatedAt } : {}) }; const response = editingRoom ? await api.patch<Conversation>('/institution/conversations/' + encodeURIComponent(editingRoom.id), data) : await api.post<Conversation>('/institution/conversations', data); roomVersion.current++; setRooms(current => [response.data, ...current.filter(room => room.id !== response.data.id)]); setSelected(response.data.id); setCreating(false); setEditingRoom(null); setNome(''); setMembers([]); setSuccess(editingRoom ? 'Grupo e participantes atualizados.' : 'Conversa criada.'); }
    catch (failure) { setError(errorText(failure, 'Não foi possível criar a conversa.')); }
    finally { lock.current = false; setBusy(false); }
  }
  async function archiveRoom(item: Conversation) {
    if (lock.current) return; lock.current = true; setBusy(true); setError(''); setSuccess(''); roomVersion.current++;
    try {
      const response = await api.patch<Conversation>('/institution/conversations/' + encodeURIComponent(item.id), { nome: item.nome, memberIds: item.memberIds, expectedUpdatedAt: item.updatedAt, archived: !item.archivedAt });
      roomVersion.current++; setRooms(current => current.map(room => room.id === item.id ? response.data : room)); setCreating(false);
      setSuccess(item.archivedAt ? 'Conversa restaurada.' : 'Conversa arquivada. O histórico permanece disponível; novos envios foram bloqueados.');
    } catch (failure) { setError(errorText(failure, 'Não foi possível alterar a conversa.')); }
    finally { lock.current = false; setBusy(false); }
  }
  async function send(event: React.FormEvent) {
    event.preventDefault(); const roomId = selected; const body = (drafts[roomId] || '').trim(); if (!body || lock.current || rooms.find(room => room.id === roomId)?.archivedAt) return; lock.current = true; setBusy(true); setError('');
    try {
      const response = await api.post<Message>(`/institution/conversations/${encodeURIComponent(roomId)}/messages`, { body });
      if (selectedRef.current === roomId) { scrollToLatest.current = true; setMessages(current => current.some(message => message.id === response.data.id) ? current : [...current, response.data].slice(-100)); }
      setDrafts(current => ({ ...current, [roomId]: '' }));
    } catch (failure) { setError(errorText(failure, 'Não foi possível enviar. Sua mensagem foi preservada.')); }
    finally { lock.current = false; setBusy(false); }
  }
  const room = rooms.find(item => item.id === selected);
  return <><div className="iw-toolbar"><p>Somente participantes podem acessar as mensagens.</p>{canCreate && <button className="btn primary" aria-expanded={creating} disabled={busy} onClick={() => { setEditingRoom(null); setNome(''); setMembers([]); setError(''); setCreating(true); }}><Plus size={17} />Nova conversa</button>}</div><Feedback error={error || roomRefreshError} success={success} />{creating && <AppDialog title={editingRoom ? 'Editar grupo' : 'Nova conversa ou grupo'} eyebrow="CONVERSAS" busy={busy} wide onClose={() => setCreating(false)}><form className="iw-form" onSubmit={create}><Feedback error={error} /><label>Nome da conversa<input required maxLength={100} disabled={busy} value={nome} onChange={event => setNome(event.target.value)} /></label><p className="muted">Você participa automaticamente. Selecione até 499 outras pessoas (500 participantes no total).</p><fieldset disabled={busy} className="iw-reset-fieldset"><MemberPicker users={directory.users.filter(person => person.id !== userId)} selected={members} onChange={setMembers} limit={499} /></fieldset><div className="iw-actions"><button className="btn" type="button" disabled={busy} onClick={() => setCreating(false)}>Cancelar</button><button className="btn primary" disabled={busy || !nome.trim() || (!editingRoom && !members.length)}>{busy ? 'Salvando…' : editingRoom ? 'Salvar grupo' : 'Criar conversa'}</button></div></form></AppDialog>}
    {loading ? <p role="status">Carregando conversas…</p> : loadError ? <div className="iw-panel"><Feedback error={loadError} /><button className="btn" onClick={() => setRetry(value => value + 1)}>Tentar novamente</button></div> : !rooms.length ? <Empty title="Nenhuma conversa por aqui">{canCreate ? 'Crie uma conversa e reúna as pessoas da instituição.' : 'Quando a equipe incluir você em uma conversa, ela aparecerá aqui.'}</Empty> : <div className="iw-chat"><nav className="iw-room-list" aria-label="Conversas da instituição">{rooms.map(item => <button key={item.id} aria-current={selected === item.id ? 'true' : undefined} className={selected === item.id ? 'is-selected' : ''} onClick={() => { setSelected(item.id); setError(''); }}><MessageCircle size={18} /><span><strong>{item.nome}</strong><small>{item.memberIds.length} participantes{item.archivedAt ? ' · Arquivada' : ''}</small></span></button>)}</nav><section className="iw-conversation" aria-label={room?.nome || 'Mensagens'}>{room ? <><header><h2>{room.nome}</h2><p>{room.memberIds.length} participantes · Últimas 100 mensagens · Atualização automática</p>{canCreate && <div className="iw-record-actions"><button className="btn" disabled={busy} onClick={() => { setEditingRoom(room); setNome(room.nome); setMembers(room.memberIds.filter(id => id !== userId)); setError(''); setCreating(true); }}>Editar grupo e participantes</button><button className="btn" disabled={busy} onClick={() => void archiveRoom(room)}>{room.archivedAt ? 'Restaurar conversa' : 'Arquivar conversa'}</button></div>}</header>{room.archivedAt && <p className="iw-feedback" role="status">Conversa arquivada. Histórico disponível apenas para os participantes; novos envios estão bloqueados.</p>}<Feedback error={messageError} />{messageError && <button className="btn iw-message-retry" onClick={() => setMessageRetry(value => value + 1)}>Tentar atualizar</button>}<div ref={messageList} className="iw-messages" aria-live="polite" aria-relevant="additions" onScroll={event => { const list = event.currentTarget; scrollToLatest.current = list.scrollHeight - list.scrollTop - list.clientHeight < 100; }}>{messageLoading ? <p role="status">Carregando mensagens…</p> : !messages.length ? <p className="iw-chat-empty">Nenhuma mensagem enviada nesta conversa.</p> : messages.map(message => <article className={`iw-message${message.sender.id === userId ? ' iw-message-mine' : ''}`} key={message.id}><strong>{message.sender.nome}</strong><p>{message.body}</p><time dateTime={message.createdAt}>{dateText(message.createdAt)}</time></article>)}</div><form className="iw-composer" onSubmit={send}><label className="iw-sr-only" htmlFor="institution-message">Mensagem</label><textarea id="institution-message" required maxLength={4000} rows={2} placeholder="Escreva uma mensagem…" value={drafts[selected] || ''} disabled={busy || !!room.archivedAt} onChange={event => setDrafts(current => ({ ...current, [selected]: event.target.value }))} /><button className="btn primary" disabled={busy || !!room.archivedAt || !(drafts[selected] || '').trim()}>{busy ? 'Enviando…' : 'Enviar'}</button></form></> : <Empty title="Escolha uma conversa">Selecione uma conversa ao lado para visualizar as mensagens.</Empty>}</section></div>}
  </>;
}
