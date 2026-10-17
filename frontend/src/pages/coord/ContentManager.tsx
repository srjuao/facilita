import React, { FormEvent, useEffect, useRef, useState } from 'react';
import api from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { TopBar } from '../../components/TopBar';
import { CertificateTemplateEditor } from '../../components/CertificateTemplateEditor';
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronRight, FileText, FolderOpen, Layers, Pencil, Plus, Upload, Video, X } from 'lucide-react';
import './academic-structure.css';

type Course = { id: string; nome: string };
type Versioned = { id: string; updatedAt: string; archivedAt?: string | null };
type Period = Versioned & { nome: string; courseId: string };
type Lesson = Versioned & { titulo: string; desc?: string; prof?: string; position?: number; attachments?: { id: string; filename: string; size: number }[] };
type Subject = Versioned & { nome: string; img?: string; periodId?: string | null; finalExamId?: string | null; lessons: Lesson[] };
type Structure = { modules: Subject[]; periods: Period[] };
type Item = { kind: 'period'; value: Period } | { kind: 'module'; value: Subject } | { kind: 'lesson'; value: Lesson };
const failureText = (error: unknown, fallback: string) => (error as { response?: { data?: { error?: string } } })?.response?.data?.error || fallback;
const endpoint = (item: Item) => item.kind === 'period' ? '/institution/periods/' + encodeURIComponent(item.value.id) : '/content-management/' + (item.kind === 'module' ? 'modules' : 'lessons') + '/' + encodeURIComponent(item.value.id);
const labelFor = (item: Item) => item.kind === 'lesson' ? item.value.titulo : item.value.nome;
const resetFieldset: React.CSSProperties = { border: 0, padding: 0, margin: 0, minWidth: 0 };

const StructureDialog: React.FC<{ title: string; context: string; busy: boolean; onClose: () => void; children: React.ReactNode }> = ({ title, context, busy, onClose, children }) => {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    const previous = document.activeElement as HTMLElement | null;
    node?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    node?.querySelector<HTMLElement>('input:not([disabled]), select:not([disabled]), textarea:not([disabled])')?.focus();
    return () => {
      node?.close(); document.body.style.overflow = previousOverflow;
      requestAnimationFrame(() => {
        if (previous?.isConnected && !previous.matches(':disabled')) previous.focus();
        else document.querySelector<HTMLElement>('.academic-context')?.focus();
      });
    };
  }, []);
  return <dialog ref={dialog} className="academic-dialog" aria-labelledby="academic-dialog-title" aria-describedby="academic-dialog-context" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} onClick={event => { if (event.target === event.currentTarget && !busy) { const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose(); } }}><div className="academic-dialog-heading"><div><p id="academic-dialog-context" className="eyebrow">{context}</p><h2 id="academic-dialog-title">{title}</h2></div><button className="academic-icon-button" type="button" disabled={busy} onClick={onClose} aria-label="Fechar janela"><X size={20} /></button></div>{children}</dialog>;
};

export const ContentManager: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const coordinator = user?.role === 'coord';
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState(coordinator ? '' : user?.courseId || '');
  const [directoryStatus, setDirectoryStatus] = useState<'loading' | 'ready' | 'error'>(coordinator ? 'loading' : 'ready');
  const [modules, setModules] = useState<Subject[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [retry, setRetry] = useState(0); const [loadError, setLoadError] = useState('');
  const [moduleName, setModuleName] = useState(''); const [periodName, setPeriodName] = useState('');
  const [courseName, setCourseName] = useState(''); const [creatingCourse, setCreatingCourse] = useState(false);
  const [creating, setCreating] = useState<'period' | 'module' | 'lesson' | null>(null);
  const [periodId, setPeriodId] = useState(''); const [moduleId, setModuleId] = useState('');
  const [title, setTitle] = useState(''); const [file, setFile] = useState<File>();
  const [coverFile, setCoverFile] = useState<File>(); const [attachmentFile, setAttachmentFile] = useState<File>();
  const [exams, setExams] = useState<{ id: string; nome: string; published: boolean }[]>([]);
  const videoInput = useRef<HTMLInputElement>(null);
  const uploadedVideo = useRef<{ file: File; url: string } | null>(null);
  const [busy, setBusy] = useState(false); const lock = useRef(false); const mounted = useRef(true);
  const [message, setMessage] = useState(''); const [error, setError] = useState('');
  const [view, setView] = useState<'active' | 'archived'>('active');
  const [editing, setEditing] = useState<Item | null>(null); const [confirming, setConfirming] = useState<Item | null>(null);
  const [editName, setEditName] = useState(''); const [editDescription, setEditDescription] = useState(''); const [editPeriod, setEditPeriod] = useState(''); const [editFinalExamId, setEditFinalExamId] = useState('');
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    setTitle(''); setFile(undefined); setModuleName(''); setPeriodName(''); setCoverFile(undefined); setAttachmentFile(undefined);
    setEditing(null); setConfirming(null); uploadedVideo.current = null;
    if (videoInput.current) videoInput.current.value = '';
  }, [courseId, periodId, moduleId]);
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
  useEffect(() => {
    const controller = new AbortController(); setExams([]);
    if (coordinator && courseId) api.get<{ exams: { id: string; nome: string; published: boolean }[] }>('/assessments/courses/' + encodeURIComponent(courseId) + '/exams', { signal: controller.signal })
      .then(response => { if (!controller.signal.aborted) setExams(response.data.exams); }).catch(() => undefined);
    return () => controller.abort();
  }, [coordinator, courseId, retry]);
  const ready = status === 'ready' && directoryStatus === 'ready' && !!courseId;
  const activePeriods = periods.filter(period => !period.archivedAt);
  const parentArchived = (subject: Subject) => !!periods.find(period => period.id === subject.periodId)?.archivedAt;
  const activeModules = modules.filter(subject => !!subject.periodId && !subject.archivedAt && !parentArchived(subject));
  const selectedCourse = courses.find(course => course.id === courseId);
  const selectedPeriod = periods.find(period => period.id === periodId);
  const selectedSubject = modules.find(subject => subject.id === moduleId);
  const createCourse = async (event: FormEvent) => {
    event.preventDefault(); if (lock.current || !courseName.trim()) return;
    lock.current = true; setBusy(true); setError(''); setMessage('');
    try {
      const response = await api.post<{ course: Course; token?: string }>('/coord/courses', { nome: courseName.trim() });
      if (!mounted.current) return;
      if (response.data.token) localStorage.setItem('token', response.data.token);
      setCourses(current => [...current, response.data.course]); setCourseId(response.data.course.id); setCourseName(''); setCreatingCourse(false); setView('active');
      setMessage('Curso criado. Cadastre o primeiro período para organizar as matérias.');
      try { await refreshUser(); } catch { if (mounted.current) setMessage('Curso criado. Atualize a página para sincronizar seu acesso.'); }
    } catch (failure) { if (mounted.current) setError(failureText(failure, 'Não foi possível criar o curso.')); }
    finally { finish(); }
  };
  async function reload() {
    const response = await api.get<Structure>('/content-management/courses/' + encodeURIComponent(courseId) + '/structure');
    if (mounted.current) { setModules(response.data.modules); setPeriods(response.data.periods); }
  }
  const begin = () => {
    if (lock.current || !ready) return false;
    lock.current = true; setBusy(true); setMessage(''); setError(''); return true;
  };
  const finish = () => { lock.current = false; if (mounted.current) setBusy(false); };
  async function change(action: () => Promise<unknown>, success: string, afterReload?: () => void) {
    if (!begin()) return;
    try { await action(); if (!mounted.current) return; setEditing(null); setConfirming(null); await reload(); if (mounted.current) { afterReload?.(); setMessage(success); } }
    catch (failure) { if (mounted.current) setError(failureText(failure, 'Não foi possível confirmar a alteração. Atualize a estrutura antes de tentar novamente.')); }
    finally { finish(); }
  }
  const addPeriod = async (event: FormEvent) => {
    event.preventDefault(); if (!begin()) return;
    try {
      const created = (await api.post<Period>('/institution/periods', { nome: periodName.trim(), courseId })).data;
      if (!mounted.current) return;
      setPeriodId(created.id); setPeriodName(''); setCreating(null); await reload(); if (mounted.current) setMessage('Período cadastrado. Agora adicione as matérias dele.');
    } catch (failure) { if (mounted.current) setError(failureText(failure, 'Não foi possível confirmar o período. Atualize a estrutura antes de tentar novamente.')); }
    finally { finish(); }
  };
  const addModule = async (event: FormEvent) => {
    event.preventDefault(); if (!begin()) return;
    try {
      const created = (await api.post<Subject>('/modules', { nome: moduleName.trim(), courseId, periodId: activePeriods.some(period => period.id === periodId) ? periodId : null })).data;
      if (!mounted.current) return;
      setModuleId(created.id); setModuleName(''); setCreating(null);
      let coverFailed = false;
      if (coverFile) { try { const body = new FormData(); body.append('file', coverFile); await api.post('/modules/' + encodeURIComponent(created.id) + '/cover', body, { timeout: 120000 }); } catch { coverFailed = true; } }
      setCoverFile(undefined);
      try { await reload(); } catch { setRetry(value => value + 1); }
      if (mounted.current) setMessage(coverFailed ? 'Matéria cadastrada, mas a capa não foi enviada. Abra a matéria e use Editar para reenviar a imagem.' : 'Matéria cadastrada. Agora você pode adicionar suas aulas.');
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
      const created = (await api.post<Lesson>('/modules/' + encodeURIComponent(moduleId) + '/lessons', { titulo: title.trim(), videoUrl: video })).data;
      if (!mounted.current) return;
      setCreating(null);
      let attachmentFailed = false;
      if (attachmentFile) { try { const body = new FormData(); body.append('file', attachmentFile); await api.post('/lessons/' + encodeURIComponent(created.id) + '/attachments', body, { timeout: 120000 }); } catch { attachmentFailed = true; } }
      setTitle(''); setFile(undefined); setAttachmentFile(undefined); uploadedVideo.current = null; if (videoInput.current) videoInput.current.value = '';
      try { await reload(); } catch { setRetry(value => value + 1); }
      if (mounted.current) setMessage(attachmentFailed ? 'Aula cadastrada, mas o anexo não foi enviado. Edite a aula para reenviar o arquivo.' : 'Aula salva e disponível no curso.');
    } catch (failure) { if (mounted.current) setError(failureText(failure, 'Não foi possível confirmar a aula. Confira a estrutura antes de reenviar. O arquivo enviado foi preservado quando o cadastro não foi confirmado.')); }
    finally { finish(); }
  };
  function edit(item: Item) {
    setEditing(item); setConfirming(null); setEditName(labelFor(item)); setEditDescription(item.kind === 'lesson' ? item.value.desc || '' : ''); setEditPeriod(item.kind === 'module' ? item.value.periodId || '' : ''); setEditFinalExamId(item.kind === 'module' ? item.value.finalExamId || '' : ''); setCoverFile(undefined); setAttachmentFile(undefined); setError(''); setMessage('');
  }
  function saveEdit(event: FormEvent) {
    event.preventDefault(); if (!editing) return;
    if (editing.kind === 'module' && !editPeriod) { setError('Selecione um período para vincular esta matéria.'); return; }
    const movedPeriod = editing.kind === 'module' && editPeriod !== editing.value.periodId ? editPeriod : null;
    const payload = editing.kind === 'lesson' ? { titulo: editName.trim(), desc: editDescription.trim() } : editing.kind === 'module' ? { nome: editName.trim(), periodId: editPeriod || null, ...(coordinator ? { finalExamId: editFinalExamId || null } : {}) } : { nome: editName.trim() };
    if (!begin()) return;
    void (async () => {
      try {
        await api.patch(endpoint(editing), { ...payload, expectedUpdatedAt: editing.value.updatedAt });
        if (!mounted.current) return;
        setEditing(null);
        let uploadFailed = false;
        try {
          if (editing.kind === 'module' && coverFile) { const body = new FormData(); body.append('file', coverFile); await api.post('/modules/' + encodeURIComponent(editing.value.id) + '/cover', body, { timeout: 120000 }); }
          if (editing.kind === 'lesson' && attachmentFile) { const body = new FormData(); body.append('file', attachmentFile); await api.post('/lessons/' + encodeURIComponent(editing.value.id) + '/attachments', body, { timeout: 120000 }); }
        } catch { uploadFailed = true; }
        try { await reload(); } catch { setRetry(value => value + 1); }
        if (mounted.current) { if (movedPeriod) { setPeriodId(movedPeriod); setModuleId(''); } setMessage(uploadFailed ? 'Alterações salvas, mas o arquivo não foi enviado. Abra Editar novamente para reenviar.' : 'Informações atualizadas na instituição.'); }
      } catch (failure) { if (mounted.current) setError(failureText(failure, 'Não foi possível salvar as alterações.')); }
      finally { finish(); }
    })();
  }
  function itemActions(item: Item) {
    return <div className="academic-item-actions"><button className="btn" disabled={busy} aria-label={'Editar ' + labelFor(item)} onClick={() => edit(item)}><Pencil size={14} /> Editar</button><button className="btn" disabled={busy} aria-label={(item.value.archivedAt ? 'Restaurar ' : 'Arquivar ') + labelFor(item)} onClick={() => { setConfirming(item); setEditing(null); setError(''); }}>{item.value.archivedAt ? 'Restaurar' : 'Arquivar'}</button></div>;
  }
  function moveLesson(subject: Subject, lessonId: string, direction: -1 | 1) {
    const ordered = subject.lessons.filter(item => !item.archivedAt).sort((a, b) => (a.position ?? 0) - (b.position ?? 0)).map(item => item.id);
    const index = ordered.indexOf(lessonId); const target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    void change(() => api.post('/content-management/modules/' + encodeURIComponent(subject.id) + '/reorder', { orderedLessonIds: ordered }), 'Ordem das aulas atualizada.');
  }
  const listedModules = modules.filter(subject => (periodId === '__unassigned' ? !subject.periodId : subject.periodId === periodId) && (view === 'active' ? !subject.archivedAt && !parentArchived(subject) : !!subject.archivedAt || parentArchived(subject) || subject.lessons.some(lesson => !!lesson.archivedAt)));
  const currentStep = !courseId ? 0 : !periodId ? 1 : !moduleId ? 2 : 3;
  const canCreate = ready && view === 'active' && (!periodId || !!selectedPeriod && !selectedPeriod.archivedAt && !moduleId || !!selectedSubject && activeModules.some(subject => subject.id === moduleId));
  const openCreate = () => { setError(''); setCreating(!periodId ? 'period' : !moduleId ? 'module' : 'lesson'); };
  const dialogError = error && <p className="inline-form-error" role="alert">{error}</p>;
  const emptyContent = (kind: 'module' | 'lesson') => <div className="academic-empty">{kind === 'module' ? <BookOpen size={30} /> : <Video size={30} />}<h3>{view === 'archived' ? `Nenhuma ${kind === 'module' ? 'matéria' : 'aula'} arquivada` : kind === 'module' ? 'Quais matérias fazem parte deste período?' : 'A próxima etapa é adicionar as aulas'}</h3><p>{view === 'archived' ? 'Os conteúdos arquivados aparecerão aqui.' : kind === 'module' ? 'Cadastre a primeira matéria para começar a organizar suas aulas.' : 'Envie um vídeo e dê um título. A aula ficará organizada nesta matéria.'}</p>{canCreate && <button className="btn primary" disabled={busy} onClick={openCreate}><Plus size={16} />{kind === 'module' ? 'Criar primeira matéria' : 'Adicionar primeira aula'}</button>}</div>;
  const steps = [ { label: 'Curso', detail: selectedCourse?.nome || 'Escolha ou crie', icon: BookOpen }, { label: 'Período', detail: selectedPeriod?.nome || 'Organize a sequência', icon: Layers }, { label: 'Matéria', detail: selectedSubject?.nome || 'Defina as disciplinas', icon: FolderOpen }, { label: 'Aulas', detail: 'Adicione os conteúdos', icon: Video } ];
  return <div><TopBar currentPage="Cursos e estrutura" /><div className="unit-setup academic-structure">
    <div className="page-head"><div><p className="eyebrow">Organização acadêmica · {user?.tenant?.nome}</p><h1>Cursos e estrutura</h1><p>Construa a jornada de aprendizado, uma etapa de cada vez.</p></div>{coordinator && !courseId && <button className="btn primary" disabled={busy || directoryStatus !== 'ready'} onClick={() => { setError(''); setCreatingCourse(true); }}><Plus size={17} /> Novo curso</button>}</div>
    <nav className="academic-steps" aria-label="Etapas da estrutura acadêmica">{steps.map((step, index) => { const Icon = step.icon; return <button key={step.label} className={index === currentStep ? 'is-current' : index < currentStep ? 'is-complete' : ''} disabled={busy || index > currentStep || index === 0 && !coordinator} aria-current={index === currentStep ? 'step' : undefined} onClick={() => { if (index === 0) { setCourseId(''); setPeriodId(''); setModuleId(''); } if (index === 1) { setPeriodId(''); setModuleId(''); } if (index === 2) setModuleId(''); }}><span className="academic-step-icon">{index < currentStep ? <Check size={19} /> : <Icon size={19} />}</span><span><small>Etapa {index + 1}</small><strong>{step.label}</strong><span className="academic-step-detail">{step.detail}</span></span>{index < 3 && <ChevronRight className="academic-step-chevron" size={17} />}</button>; })}</nav>
    {message && <p role="status" className="academic-success"><Check size={18} />{message}</p>}{error && !creatingCourse && !creating && !editing && !confirming && <section className="inline-form-error"><p role="alert">{error}</p><button className="btn" disabled={busy} onClick={() => setRetry(value => value + 1)}>Atualizar estrutura</button></section>}
    {coordinator && creatingCourse && <StructureDialog title="Crie um curso" context="Etapa 1 de 4 · Curso" busy={busy} onClose={() => setCreatingCourse(false)}><form className="compact-form" onSubmit={createCourse}><p className="muted">Comece pelo nome. Depois, organize os períodos, as matérias e as aulas dentro dele.</p>{dialogError}<label>Nome do curso<input required minLength={2} maxLength={80} value={courseName} onChange={event => setCourseName(event.target.value)} placeholder="Ex.: Medicina" disabled={busy} /></label><div className="academic-dialog-footer"><button className="btn" type="button" disabled={busy} onClick={() => setCreatingCourse(false)}>Cancelar</button><button className="btn primary" disabled={busy || courseName.trim().length < 2}>{busy ? 'Criando…' : 'Criar e organizar períodos'}<ArrowRight size={16} /></button></div></form></StructureDialog>}
    {coordinator && !courseId && directoryStatus === 'ready' && courses.length > 0 && <section className="academic-course-grid" aria-label="Cursos da instituição">{courses.map(course => <button className="card academic-course-button" key={course.id} onClick={() => { setCourseId(course.id); setMessage(''); setError(''); }}><BookOpen size={22} /><span><strong>{course.nome}</strong><small>Abrir períodos, matérias e aulas</small></span><ChevronRight size={19} /></button>)}</section>}
    {courseId && <nav className="academic-breadcrumb" aria-label="Estrutura do curso">{coordinator && <><button className="btn" disabled={busy} onClick={() => { setCourseId(''); setPeriodId(''); setModuleId(''); setMessage(''); setError(''); }}><ArrowLeft size={15} /> Cursos</button><ChevronRight size={15} /></>}<button disabled={busy} aria-current={!periodId ? 'page' : undefined} onClick={() => { setPeriodId(''); setModuleId(''); }}>{selectedCourse?.nome || 'Curso'}</button>{periodId && <><ChevronRight size={15} /><button disabled={busy} aria-current={!moduleId ? 'page' : undefined} onClick={() => setModuleId('')}>{selectedPeriod?.nome || 'Matérias sem período'}</button></>}{selectedSubject && <><ChevronRight size={15} /><span aria-current="page">{selectedSubject.nome}</span></>}</nav>}
    {directoryStatus === 'loading' ? <p role="status">Carregando cursos…</p> : directoryStatus === 'error' || status === 'error' ? <section className="card"><p role="alert">{loadError}</p><button className="btn" onClick={() => setRetry(value => value + 1)}>Tentar novamente</button></section> : !courseId ? (!courses.length && <section className="card"><h2>Nenhum curso disponível</h2><p>{coordinator ? 'Clique em Novo curso para começar a estrutura da instituição.' : 'Peça à coordenação para vincular sua conta a um curso.'}</p></section>) : status === 'loading' ? <p role="status">Carregando estrutura…</p> : <>
      <section className="academic-context" tabIndex={-1}><div><p className="eyebrow">Etapa {currentStep + 1} de 4 · {selectedCourse?.nome}</p><h2>{selectedSubject?.nome || selectedPeriod?.nome || (periodId === '__unassigned' ? 'Matérias sem período' : 'Organize os períodos do curso')}</h2><p>{selectedSubject ? 'Cadastre as aulas desta matéria e acompanhe a disponibilidade de cada conteúdo.' : selectedPeriod ? 'As matérias cadastradas aqui fazem parte deste período.' : periodId === '__unassigned' ? 'Edite as matérias existentes para vinculá-las a um período.' : 'Cada período reúne suas matérias. Abra um deles para continuar.'}</p></div>{canCreate && <button className="btn primary" disabled={busy} onClick={openCreate}><Plus size={17} />{!periodId ? 'Novo período' : !moduleId ? 'Nova matéria' : 'Nova aula'}</button>}</section>
      {creating && <StructureDialog title={creating === 'period' ? 'Adicione um período' : creating === 'module' ? 'Adicione uma matéria' : 'Adicione uma aula'} context={`${selectedCourse?.nome || 'Curso'}${selectedPeriod ? ' / ' + selectedPeriod.nome : ''}${selectedSubject ? ' / ' + selectedSubject.nome : ''}`} busy={busy} onClose={() => setCreating(null)}>
        <form className="compact-form" onSubmit={creating === 'period' ? addPeriod : creating === 'module' ? addModule : addLesson}>{dialogError}<fieldset disabled={busy || !ready || creating === 'lesson' && user?.tenant?.plan?.videoAulas === false} style={resetFieldset}>
          {creating === 'period' && <><p className="muted">O próximo passo será cadastrar as matérias deste período.</p><label>Nome do período<input required maxLength={100} value={periodName} onChange={event => setPeriodName(event.target.value)} placeholder="Ex.: Primeiro semestre" /></label></>}
          {creating === 'module' && <><p className="muted">Esta matéria ficará em {selectedPeriod?.nome}. Depois, adicione as aulas.</p><label>Nome da matéria<input required maxLength={120} value={moduleName} onChange={event => setModuleName(event.target.value)} placeholder="Nome da disciplina" /></label><label className="academic-upload"><span><Upload size={19} />Capa da matéria (opcional)</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={event => setCoverFile(event.target.files?.[0])} /><small>{coverFile?.name || 'PNG, JPG ou WebP · até 5 MB. A capa aparecerá no card do aluno.'}</small></label></>}
          {creating === 'lesson' && <><p className="muted">A aula ficará vinculada a {selectedSubject?.nome}, dentro de {selectedPeriod?.nome}. As aulas são liberadas na ordem em que aparecem.</p><label>Título da aula<input required maxLength={200} value={title} onChange={event => setTitle(event.target.value)} placeholder="Como esta aula será chamada?" /></label><label className="academic-upload"><span><Upload size={19} />Arquivo de vídeo</span><input ref={videoInput} required={!file} type="file" accept="video/mp4,video/webm,video/quicktime" onChange={event => { setFile(event.target.files?.[0]); uploadedVideo.current = null; }} /><small>{file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB` : 'Selecione um vídeo MP4, WebM ou MOV.'}</small></label><label className="academic-upload"><span><FileText size={19} />Arquivo da atividade (opcional)</span><input type="file" accept="application/pdf,image/png,image/jpeg,.docx" onChange={event => setAttachmentFile(event.target.files?.[0])} /><small>{attachmentFile?.name || 'PDF, DOCX, PNG ou JPG · até 20 MB.'}</small></label></>}
          <div className="academic-dialog-footer"><button type="button" className="btn" disabled={busy} onClick={() => setCreating(null)}>Cancelar</button><button className="btn primary" disabled={busy || (creating === 'period' ? !periodName.trim() : creating === 'module' ? !moduleName.trim() : !title.trim() || !file)}>{busy ? 'Salvando…' : creating === 'period' ? 'Criar e organizar matérias' : creating === 'module' ? 'Criar e adicionar aulas' : 'Salvar aula'}<ArrowRight size={16} /></button></div>
        </fieldset>{creating === 'lesson' && user?.tenant?.plan?.videoAulas === false && <p role="status">Videoaulas não estão incluídas no plano desta instituição.</p>}</form>
      </StructureDialog>}
      {editing && <StructureDialog title={'Editar ' + (editing.kind === 'period' ? 'período' : editing.kind === 'module' ? 'matéria' : 'aula')} context={labelFor(editing)} busy={busy} onClose={() => setEditing(null)}><form className="compact-form" onSubmit={saveEdit}>{dialogError}<fieldset disabled={busy} style={resetFieldset}><label>{editing.kind === 'lesson' ? 'Título da aula' : 'Nome'}<input required maxLength={editing.kind === 'lesson' ? 200 : editing.kind === 'period' ? 100 : 120} value={editName} onChange={event => setEditName(event.target.value)} /></label>{editing.kind === 'module' && <><label>Período<select value={editPeriod} onChange={event => setEditPeriod(event.target.value)}><option value="">Selecione um período</option>{periods.filter(period => !period.archivedAt || period.id === editPeriod).map(period => <option key={period.id} value={period.id} disabled={!!period.archivedAt}>{period.nome}{period.archivedAt ? ' (arquivado)' : ''}</option>)}</select></label><label className="academic-upload"><span><Upload size={19} />Capa da matéria</span>{editing.value.img && <img className="academic-cover-preview" src={editing.value.img} alt="Capa atual da matéria" />}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={event => setCoverFile(event.target.files?.[0])} /><small>{coverFile?.name || 'Escolha uma nova imagem para trocar a capa.'}</small></label>{coordinator && <label>Prova final da matéria<select value={editFinalExamId} onChange={event => setEditFinalExamId(event.target.value)}><option value="">Sem prova final</option>{exams.map(exam => <option key={exam.id} value={exam.id}>{exam.nome}{exam.published ? '' : ' (rascunho)'}</option>)}</select><small>Crie e publique a avaliação em Provas e simulados. Ela será liberada após todas as aulas.</small></label>}</>}{editing.kind === 'lesson' && <><label>Descrição<textarea rows={3} maxLength={4000} value={editDescription} onChange={event => setEditDescription(event.target.value)} /></label><label className="academic-upload"><span><FileText size={19} />Anexar arquivo à aula</span><input type="file" accept="application/pdf,image/png,image/jpeg,.docx" onChange={event => setAttachmentFile(event.target.files?.[0])} /><small>{attachmentFile?.name || 'PDF, DOCX, PNG ou JPG · até 20 MB.'}</small></label>{editing.value.attachments?.length ? <p className="muted">Arquivos atuais: {editing.value.attachments.map(asset => asset.filename).join(', ')}</p> : null}<p className="muted">O vídeo e os registros de conclusão desta aula serão preservados.</p></>}<div className="academic-dialog-footer"><button type="button" className="btn" disabled={busy} onClick={() => setEditing(null)}>Cancelar</button><button className="btn primary" disabled={busy || !editName.trim()}>{busy ? 'Salvando…' : 'Salvar alterações'}</button></div></fieldset></form></StructureDialog>}
      {confirming && <StructureDialog title={(confirming.value.archivedAt ? 'Restaurar ' : 'Arquivar ') + labelFor(confirming) + '?'} context="Disponibilidade do conteúdo" busy={busy} onClose={() => setConfirming(null)}>{dialogError}<p>{confirming.value.archivedAt ? 'O registro volta a ficar ativo. Se o período ou a matéria ainda estiver arquivado, seu conteúdo continuará oculto aos alunos.' : 'O registro e seu conteúdo deixam de aparecer para os alunos. O histórico permanece preservado.'}</p><div className="academic-dialog-footer"><button className="btn" disabled={busy} onClick={() => setConfirming(null)}>Cancelar</button><button className="btn primary" disabled={busy} onClick={() => void change(() => api.patch(endpoint(confirming), { ...(confirming.kind === 'period' ? { nome: confirming.value.nome } : {}), archived: !confirming.value.archivedAt, expectedUpdatedAt: confirming.value.updatedAt }), confirming.value.archivedAt ? 'Registro restaurado. Confira também a disponibilidade do período e da matéria.' : 'Registro arquivado sem excluir o histórico.')}>{busy ? 'Salvando…' : confirming.value.archivedAt ? 'Restaurar' : 'Arquivar'}</button></div></StructureDialog>}
      {coordinator && (moduleId && selectedSubject ? <CertificateTemplateEditor key={moduleId} courseId={courseId} courseName={selectedCourse?.nome || 'Curso'} moduleId={moduleId} moduleName={selectedSubject.nome} institutionName={user?.tenant?.nome} /> : !periodId ? <CertificateTemplateEditor key={courseId} courseId={courseId} courseName={selectedCourse?.nome || 'Curso'} institutionName={user?.tenant?.nome} /> : null)}
      <section className="card academic-list"><div className="academic-list-heading"><h2>{selectedSubject ? `Aulas de ${selectedSubject.nome}` : periodId ? `Matérias · ${selectedPeriod?.nome || 'Sem período'}` : `Períodos de ${selectedCourse?.nome || 'curso'}`}</h2><div className="academic-view-switch" role="group" aria-label="Disponibilidade da estrutura"><button aria-pressed={view === 'active'} onClick={() => setView('active')}>Ativos</button><button aria-pressed={view === 'archived'} onClick={() => setView('archived')}>Arquivados</button></div></div>
        {!periodId && <><p className="muted">Abra um período para organizar suas matérias.</p>{periods.filter(period => view === 'active' ? !period.archivedAt : !!period.archivedAt || modules.some(subject => subject.periodId === period.id && (subject.archivedAt || subject.lessons.some(lesson => lesson.archivedAt)))).map(period => <article key={period.id} className="academic-structure-row"><button className="academic-open" disabled={busy} onClick={() => { setPeriodId(period.id); setModuleId(''); setEditing(null); setConfirming(null); }}><span><strong>{period.nome}</strong><small>{modules.filter(subject => subject.periodId === period.id && !subject.archivedAt).length} matérias ativas{period.archivedAt ? ' · Período arquivado' : ''}</small></span><ChevronRight size={18} /></button>{itemActions({ kind: 'period', value: period })}</article>)}{!periods.some(period => view === 'active' ? !period.archivedAt : !!period.archivedAt || modules.some(subject => subject.periodId === period.id && (subject.archivedAt || subject.lessons.some(lesson => lesson.archivedAt)))) && <div className="academic-empty"><Layers size={30} /><h3>{view === 'active' ? 'Comece pelo primeiro período' : 'Nenhum período arquivado'}</h3><p>{view === 'active' ? 'Organize a sequência do curso. As matérias e aulas ficam dentro de cada período.' : 'Os períodos e conteúdos arquivados aparecerão aqui.'}</p>{view === 'active' && <button className="btn primary" disabled={busy} onClick={openCreate}><Plus size={16} /> Criar primeiro período</button>}</div>}{modules.some(subject => !subject.periodId) && <button className="btn" disabled={busy} onClick={() => { setPeriodId('__unassigned'); setModuleId(''); }}>Organizar matérias sem período</button>}</>}
        {periodId && !moduleId && <>{selectedPeriod && <div className="academic-selected-period">{itemActions({ kind: 'period', value: selectedPeriod })}</div>}{listedModules.length ? listedModules.map(subject => <article className="academic-structure-row" key={subject.id}><button className="academic-open" disabled={busy} onClick={() => { setModuleId(subject.id); setEditing(null); setConfirming(null); }}><span><strong>{subject.nome}</strong><small>{subject.lessons.filter(lesson => !lesson.archivedAt).length} aulas ativas{subject.archivedAt ? ' · Matéria arquivada' : ''}</small></span><ChevronRight size={18} /></button>{itemActions({ kind: 'module', value: subject })}</article>) : emptyContent('module')}</>}
        {selectedSubject && [selectedSubject].map(subject => {
          const hiddenByParent = parentArchived(subject); const hidden = !!subject.archivedAt || hiddenByParent;
          const lessons = subject.lessons.filter(lesson => view === 'active' ? !lesson.archivedAt : hidden || !!lesson.archivedAt);
          return <article key={subject.id} style={{ padding: '20px 0', overflowWrap: 'anywhere' }}>
            <p className="muted">{subject.archivedAt ? 'Matéria arquivada' : hiddenByParent ? 'Matéria ativa, oculta pelo período arquivado' : 'Matéria ativa'}</p>
            {itemActions({ kind: 'module', value: subject })}
            <div className="academic-lessons">{lessons.length ? lessons.map((lesson, index) => <section key={lesson.id} className="academic-lesson-row"><div className="academic-lesson-number"><Video size={18} /><small>{String(index + 1).padStart(2, '0')}</small></div><div className="academic-lesson-info"><strong>{lesson.titulo}</strong>{lesson.desc && <p style={{ whiteSpace: 'pre-wrap' }}>{lesson.desc}</p>}<p className="muted">{lesson.archivedAt ? 'Aula arquivada' : hidden ? 'Aula ativa, oculta pela matéria ou pelo período arquivado' : 'Aula disponível'}{lesson.prof ? ' · ' + lesson.prof : ''}{lesson.attachments?.length ? ` · ${lesson.attachments.length} arquivo(s)` : ''}</p></div>{view === 'active' && <div className="academic-reorder"><button className="btn" disabled={busy || index === 0} onClick={() => moveLesson(subject, lesson.id, -1)} aria-label={`Mover ${lesson.titulo} para cima`}>↑</button><button className="btn" disabled={busy || index === lessons.length - 1} onClick={() => moveLesson(subject, lesson.id, 1)} aria-label={`Mover ${lesson.titulo} para baixo`}>↓</button></div>}{itemActions({ kind: 'lesson', value: lesson })}</section>) : emptyContent('lesson')}</div>
          </article>;
        })}
      </section>
    </>}
  </div></div>;
};
