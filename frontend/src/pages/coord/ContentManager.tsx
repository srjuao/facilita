import React, { FormEvent, useEffect, useRef, useState } from 'react';
import api from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { TopBar } from '../../components/TopBar';

type Course = { id: string; nome: string };
type Versioned = { id: string; updatedAt: string; archivedAt?: string | null };
type Period = Versioned & { nome: string; courseId: string };
type Lesson = Versioned & { titulo: string; desc?: string; prof?: string };
type Subject = Versioned & { nome: string; periodId?: string | null; lessons: Lesson[] };
type Structure = { modules: Subject[]; periods: Period[] };
type Item = { kind: 'period'; value: Period } | { kind: 'module'; value: Subject } | { kind: 'lesson'; value: Lesson };
const failureText = (error: unknown, fallback: string) => (error as { response?: { data?: { error?: string } } })?.response?.data?.error || fallback;
const endpoint = (item: Item) => item.kind === 'period' ? '/institution/periods/' + encodeURIComponent(item.value.id) : '/content-management/' + (item.kind === 'module' ? 'modules' : 'lessons') + '/' + encodeURIComponent(item.value.id);
const labelFor = (item: Item) => item.kind === 'lesson' ? item.value.titulo : item.value.nome;
const actionsStyle: React.CSSProperties = { display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 };
const resetFieldset: React.CSSProperties = { border: 0, padding: 0, margin: 0, minWidth: 0 };

export const ContentManager: React.FC = () => {
  const { user } = useAuth();
  const coordinator = user?.role === 'coord';
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState(coordinator ? '' : user?.courseId || '');
  const [directoryStatus, setDirectoryStatus] = useState<'loading' | 'ready' | 'error'>(coordinator ? 'loading' : 'ready');
  const [modules, setModules] = useState<Subject[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [retry, setRetry] = useState(0); const [loadError, setLoadError] = useState('');
  const [moduleName, setModuleName] = useState(''); const [periodName, setPeriodName] = useState('');
  const [periodId, setPeriodId] = useState(''); const [moduleId, setModuleId] = useState('');
  const [title, setTitle] = useState(''); const [file, setFile] = useState<File>();
  const videoInput = useRef<HTMLInputElement>(null);
  const uploadedVideo = useRef<{ file: File; url: string } | null>(null);
  const [busy, setBusy] = useState(false); const lock = useRef(false); const mounted = useRef(true);
  const [message, setMessage] = useState(''); const [error, setError] = useState('');
  const [view, setView] = useState<'active' | 'archived'>('active');
  const [editing, setEditing] = useState<Item | null>(null); const [confirming, setConfirming] = useState<Item | null>(null);
  const [editName, setEditName] = useState(''); const [editDescription, setEditDescription] = useState(''); const [editPeriod, setEditPeriod] = useState('');
  const editorHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { if (editing) editorHeading.current?.focus(); }, [editing]);
  useEffect(() => {
    const controller = new AbortController();
    if (!coordinator) {
      setCourseId(user?.courseId || '');
      setCourses(user?.course ? [{ id: user.courseId || '', nome: user.course.nome }] : []);
      setDirectoryStatus('ready'); return () => controller.abort();
    }
    setDirectoryStatus('loading'); setLoadError('');
    api.get<{ courses: Course[] }>('/institution/directory', { signal: controller.signal })
      .then(response => { if (!controller.signal.aborted) { setCourses(response.data.courses); setDirectoryStatus('ready'); } })
      .catch(failure => { if (!controller.signal.aborted) { setDirectoryStatus('error'); setLoadError(failureText(failure, 'Não foi possível carregar os cursos.')); } });
    return () => controller.abort();
  }, [coordinator, user?.id, user?.courseId, retry]);
  useEffect(() => {
    const controller = new AbortController();
    setModules([]); setPeriods([]); setModuleId(''); setPeriodId(''); setEditing(null); setConfirming(null); setStatus('loading');
    if (!courseId || directoryStatus !== 'ready') { setStatus('ready'); return () => controller.abort(); }
    setLoadError('');
    api.get<Structure>('/content-management/courses/' + encodeURIComponent(courseId) + '/structure', { signal: controller.signal })
      .then(response => { if (!controller.signal.aborted) { setModules(response.data.modules); setPeriods(response.data.periods); setStatus('ready'); } })
      .catch(failure => { if (!controller.signal.aborted) { setStatus('error'); setLoadError(failureText(failure, 'Não foi possível carregar a estrutura do curso.')); } });
    return () => controller.abort();
  }, [courseId, directoryStatus, retry]);
  const ready = status === 'ready' && directoryStatus === 'ready' && !!courseId;
  const activePeriods = periods.filter(period => !period.archivedAt);
  const parentArchived = (subject: Subject) => !!periods.find(period => period.id === subject.periodId)?.archivedAt;
  const activeModules = modules.filter(subject => !subject.archivedAt && !parentArchived(subject));
  async function reload() {
    const response = await api.get<Structure>('/content-management/courses/' + encodeURIComponent(courseId) + '/structure');
    if (mounted.current) { setModules(response.data.modules); setPeriods(response.data.periods); }
  }
  const begin = () => {
    if (lock.current || !ready) return false;
    lock.current = true; setBusy(true); setMessage(''); setError(''); return true;
  };
  const finish = () => { lock.current = false; if (mounted.current) setBusy(false); };
  async function change(action: () => Promise<unknown>, success: string) {
    if (!begin()) return;
    try { await action(); if (!mounted.current) return; setEditing(null); setConfirming(null); await reload(); if (mounted.current) setMessage(success); }
    catch (failure) { if (mounted.current) setError(failureText(failure, 'Não foi possível confirmar a alteração. Atualize a estrutura antes de tentar novamente.')); }
    finally { finish(); }
  }
  const addPeriod = async (event: FormEvent) => {
    event.preventDefault(); if (!begin()) return;
    try {
      const created = (await api.post<Period>('/institution/periods', { nome: periodName.trim(), courseId })).data;
      if (!mounted.current) return;
      setPeriodId(created.id); setPeriodName(''); await reload(); if (mounted.current) setMessage('Período cadastrado no curso.');
    } catch (failure) { if (mounted.current) setError(failureText(failure, 'Não foi possível confirmar o período. Atualize a estrutura antes de tentar novamente.')); }
    finally { finish(); }
  };
  const addModule = async (event: FormEvent) => {
    event.preventDefault(); if (!begin()) return;
    try {
      const created = (await api.post<Subject>('/modules', { nome: moduleName.trim(), courseId, periodId: activePeriods.some(period => period.id === periodId) ? periodId : null })).data;
      if (!mounted.current) return;
      setModuleId(created.id); setModuleName(''); await reload(); if (mounted.current) setMessage('Matéria salva no curso.');
    } catch (failure) { if (mounted.current) setError(failureText(failure, 'Não foi possível confirmar a matéria. Atualize a estrutura antes de tentar novamente.')); }
    finally { finish(); }
  };
  const addLesson = async (event: FormEvent) => {
    event.preventDefault(); if (!file || !activeModules.some(subject => subject.id === moduleId) || !begin()) return;
    try {
      let video = uploadedVideo.current?.file === file ? uploadedVideo.current.url : '';
      if (!video) {
        const body = new FormData(); body.append('video', file);
        video = (await api.post<{ videoUrl: string }>('/upload/video', body, { timeout: 120000 })).data.videoUrl;
        uploadedVideo.current = { file, url: video };
      }
      await api.post<Lesson>('/modules/' + encodeURIComponent(moduleId) + '/lessons', { titulo: title.trim(), videoUrl: video });
      if (!mounted.current) return;
      setTitle(''); setFile(undefined); uploadedVideo.current = null; if (videoInput.current) videoInput.current.value = '';
      await reload(); if (mounted.current) setMessage('Aula salva e disponível no curso.');
    } catch (failure) { if (mounted.current) setError(failureText(failure, 'Não foi possível confirmar a aula. Confira a estrutura antes de reenviar. O arquivo enviado foi preservado quando o cadastro não foi confirmado.')); }
    finally { finish(); }
  };
  function edit(item: Item) {
    setEditing(item); setConfirming(null); setEditName(labelFor(item)); setEditDescription(item.kind === 'lesson' ? item.value.desc || '' : ''); setEditPeriod(item.kind === 'module' ? item.value.periodId || '' : ''); setError(''); setMessage('');
  }
  function saveEdit(event: FormEvent) {
    event.preventDefault(); if (!editing) return;
    const payload = editing.kind === 'lesson' ? { titulo: editName.trim(), desc: editDescription.trim() } : editing.kind === 'module' ? { nome: editName.trim(), periodId: editPeriod || null } : { nome: editName.trim() };
    void change(() => api.patch(endpoint(editing), { ...payload, expectedUpdatedAt: editing.value.updatedAt }), 'Informações atualizadas na instituição.');
  }
  function itemActions(item: Item) {
    return <div style={actionsStyle}><button className="btn" disabled={busy} aria-label={'Editar ' + labelFor(item)} onClick={() => edit(item)}>Editar</button><button className="btn" disabled={busy} aria-label={(item.value.archivedAt ? 'Restaurar ' : 'Arquivar ') + labelFor(item)} onClick={() => { setConfirming(item); setEditing(null); }}>{item.value.archivedAt ? 'Restaurar' : 'Arquivar'}</button></div>;
  }
  const listedModules = modules.filter(subject => view === 'active' ? !subject.archivedAt && !parentArchived(subject) : !!subject.archivedAt || parentArchived(subject) || subject.lessons.some(lesson => !!lesson.archivedAt));
  return <div><TopBar currentPage="Períodos, matérias e aulas" /><div className="unit-setup">
    <div className="page-head"><div><p className="eyebrow">{user?.tenant?.nome}</p><h1>Períodos, matérias e aulas</h1><p>Organize o curso e mantenha seu acervo atualizado. Arquivar oculta o conteúdo sem apagar o histórico.</p></div></div>
    {message && <p role="status" className="card">{message}</p>}{error && <section className="inline-form-error"><p role="alert">{error}</p><button className="btn" disabled={busy} onClick={() => setRetry(value => value + 1)}>Atualizar estrutura</button></section>}
    {coordinator && <section className="card"><label htmlFor="managed-course"><strong>Curso que deseja gerenciar</strong></label><select id="managed-course" disabled={busy || directoryStatus !== 'ready'} value={courseId} onChange={event => { setCourseId(event.target.value); setMessage(''); setError(''); setModuleName(''); setPeriodName(''); setTitle(''); setFile(undefined); uploadedVideo.current = null; if (videoInput.current) videoInput.current.value = ''; }}><option value="">Selecione um curso</option>{courses.map(course => <option key={course.id} value={course.id}>{course.nome}</option>)}</select><p className="muted">Os registros abaixo pertencem somente ao curso selecionado.</p></section>}
    {directoryStatus === 'loading' ? <p role="status">Carregando cursos…</p> : directoryStatus === 'error' || status === 'error' ? <section className="card"><p role="alert">{loadError}</p><button className="btn" onClick={() => setRetry(value => value + 1)}>Tentar novamente</button></section> : !courseId ? <section className="card"><h2>{coordinator && courses.length ? 'Selecione um curso para começar' : 'Nenhum curso disponível'}</h2><p>{coordinator ? 'Escolha um curso acima ou cadastre o primeiro em Unidade e equipe.' : 'Peça à coordenação para vincular sua conta a um curso.'}</p></section> : status === 'loading' ? <p role="status">Carregando estrutura…</p> : <>
      <div className="unit-setup-grid">
        <form className="card compact-form" onSubmit={addPeriod}><h2>Cadastrar período</h2><fieldset disabled={busy || !ready} style={resetFieldset}><label>Nome do período<input required maxLength={100} value={periodName} onChange={event => setPeriodName(event.target.value)} placeholder="Ex.: Primeiro semestre" /></label><button className="btn primary" disabled={busy || !periodName.trim()}>Salvar período</button></fieldset></form>
        <form className="card compact-form" onSubmit={addModule}><h2>Cadastrar matéria</h2><fieldset disabled={busy || !ready} style={resetFieldset}><label>Nome da matéria<input required maxLength={120} value={moduleName} onChange={event => setModuleName(event.target.value)} /></label><label>Período<select value={activePeriods.some(period => period.id === periodId) ? periodId : ''} onChange={event => setPeriodId(event.target.value)}><option value="">Sem período</option>{activePeriods.map(period => <option key={period.id} value={period.id}>{period.nome}</option>)}</select></label><button className="btn primary" disabled={busy || !moduleName.trim()}>Salvar matéria</button></fieldset></form>
        <form className="card compact-form" onSubmit={addLesson}><h2>Cadastrar videoaula</h2>{user?.tenant?.plan?.videoAulas === false && <p role="status">Videoaulas não estão incluídas no plano desta instituição.</p>}<fieldset disabled={busy || !ready || user?.tenant?.plan?.videoAulas === false} style={resetFieldset}><label>Matéria<select required value={activeModules.some(subject => subject.id === moduleId) ? moduleId : ''} onChange={event => setModuleId(event.target.value)}><option value="">Selecione uma matéria ativa</option>{activeModules.map(subject => <option key={subject.id} value={subject.id}>{subject.nome}</option>)}</select></label><label>Título da aula<input required maxLength={200} value={title} onChange={event => setTitle(event.target.value)} /></label><label>Arquivo de vídeo<input ref={videoInput} required type="file" accept="video/mp4,video/webm,video/quicktime" onChange={event => { setFile(event.target.files?.[0]); uploadedVideo.current = null; }} /></label><button className="btn primary" disabled={busy || !activeModules.some(subject => subject.id === moduleId) || !title.trim() || !file}>{busy ? 'Salvando…' : 'Salvar aula'}</button></fieldset></form>
      </div>
      {editing && <form className="card compact-form" onSubmit={saveEdit}><h2 ref={editorHeading} tabIndex={-1}>Editar {editing.kind === 'period' ? 'período' : editing.kind === 'module' ? 'matéria' : 'aula'}</h2><fieldset disabled={busy} style={resetFieldset}><label>{editing.kind === 'lesson' ? 'Título da aula' : 'Nome'}<input required maxLength={editing.kind === 'lesson' ? 200 : editing.kind === 'period' ? 100 : 120} value={editName} onChange={event => setEditName(event.target.value)} /></label>{editing.kind === 'module' && <label>Período<select value={editPeriod} onChange={event => setEditPeriod(event.target.value)}><option value="">Sem período</option>{periods.filter(period => !period.archivedAt || period.id === editPeriod).map(period => <option key={period.id} value={period.id} disabled={!!period.archivedAt}>{period.nome}{period.archivedAt ? ' (arquivado)' : ''}</option>)}</select></label>}{editing.kind === 'lesson' && <><label>Descrição<textarea rows={3} maxLength={4000} value={editDescription} onChange={event => setEditDescription(event.target.value)} /></label><p className="muted">Este editor preserva o vídeo e os registros de acesso da aula.</p></>}<div style={actionsStyle}><button className="btn primary" disabled={busy || !editName.trim()}>{busy ? 'Salvando…' : 'Salvar alterações'}</button><button type="button" className="btn" disabled={busy} onClick={() => setEditing(null)}>Cancelar</button></div></fieldset></form>}
      {confirming && <section className="card" aria-label="Confirmar alteração de disponibilidade"><h2>{confirming.value.archivedAt ? 'Restaurar' : 'Arquivar'} {labelFor(confirming)}?</h2><p>{confirming.value.archivedAt ? 'O registro volta a ficar ativo. Se o período ou a matéria ainda estiver arquivado, seu conteúdo continuará oculto aos alunos.' : 'O registro e seu conteúdo deixam de aparecer para os alunos. Nada será excluído; o histórico permanece preservado.'}</p><div style={actionsStyle}><button className="btn primary" disabled={busy} onClick={() => void change(() => api.patch(endpoint(confirming), { ...(confirming.kind === 'period' ? { nome: confirming.value.nome } : {}), archived: !confirming.value.archivedAt, expectedUpdatedAt: confirming.value.updatedAt }), confirming.value.archivedAt ? 'Registro restaurado. Confira também a disponibilidade do período e da matéria.' : 'Registro arquivado sem excluir o histórico.')}>{busy ? 'Salvando…' : 'Confirmar'}</button><button className="btn" disabled={busy} onClick={() => setConfirming(null)}>Cancelar</button></div></section>}
      <section className="card"><h2>Estrutura do curso</h2><div style={actionsStyle} role="group" aria-label="Disponibilidade da estrutura"><button className={view === 'active' ? 'btn primary' : 'btn'} aria-pressed={view === 'active'} onClick={() => setView('active')}>Ativos</button><button className={view === 'archived' ? 'btn primary' : 'btn'} aria-pressed={view === 'archived'} onClick={() => setView('archived')}>Arquivados</button></div>
        <h3 style={{ marginTop: 24 }}>Períodos</h3>{periods.filter(period => view === 'active' ? !period.archivedAt : !!period.archivedAt).map(period => <article key={period.id} style={{ padding: '14px 0', borderBottom: '1px solid var(--line-2)', overflowWrap: 'anywhere' }}><strong>{period.nome}</strong><p className="muted">{period.archivedAt ? 'Arquivado · matérias e aulas deste período ficam ocultas' : 'Ativo'}</p>{itemActions({ kind: 'period', value: period })}</article>)}{!periods.some(period => view === 'active' ? !period.archivedAt : !!period.archivedAt) && <p className="muted">Nenhum período {view === 'active' ? 'ativo' : 'arquivado'}.</p>}
        <h3 style={{ marginTop: 28 }}>Matérias e aulas</h3>{listedModules.length ? listedModules.map(subject => {
          const hiddenByParent = parentArchived(subject); const hidden = !!subject.archivedAt || hiddenByParent;
          const lessons = subject.lessons.filter(lesson => view === 'active' ? !lesson.archivedAt : hidden || !!lesson.archivedAt);
          return <article key={subject.id} style={{ padding: '20px 0', borderBottom: '1px solid var(--line-2)', overflowWrap: 'anywhere' }}><p className="eyebrow">{periods.find(period => period.id === subject.periodId)?.nome || 'Sem período'}</p><h3>{subject.nome}</h3><p className="muted">{subject.archivedAt ? 'Matéria arquivada' : hiddenByParent ? 'Matéria ativa, oculta pelo período arquivado' : 'Matéria ativa'}</p>{itemActions({ kind: 'module', value: subject })}<div style={{ marginTop: 18, paddingLeft: 16, borderLeft: '2px solid var(--line)' }}>{lessons.length ? lessons.map(lesson => <section key={lesson.id} style={{ padding: '12px 0' }}><strong>{lesson.titulo}</strong>{lesson.desc && <p style={{ whiteSpace: 'pre-wrap' }}>{lesson.desc}</p>}<p className="muted">{lesson.archivedAt ? 'Aula arquivada' : hidden ? 'Aula ativa, oculta pela matéria ou pelo período arquivado' : 'Aula disponível'}{lesson.prof ? ' · ' + lesson.prof : ''}</p>{itemActions({ kind: 'lesson', value: lesson })}</section>) : <p className="muted">Nenhuma aula {view === 'active' ? 'ativa' : 'arquivada'} nesta matéria.</p>}</div></article>;
        }) : <p className="muted">{view === 'active' ? 'Nenhuma matéria ativa neste curso. Crie a primeira acima.' : 'Nenhuma matéria ou aula arquivada.'}</p>}
      </section>
    </>}
  </div></div>;
};
