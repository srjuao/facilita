import React, { FormEvent, useEffect, useRef, useState } from 'react';
import api from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { TopBar } from '../../components/TopBar';

type Course = { id: string; nome: string };
type Period = { id: string; nome: string; courseId: string };
type Lesson = { id: string; titulo: string; prof?: string };
type Subject = { id: string; nome: string; periodId?: string | null; lessons: Lesson[] };
const failureText = (error: unknown, fallback: string) => (error as { response?: { data?: { error?: string } } })?.response?.data?.error || fallback;

export const ContentManager: React.FC = () => {
  const { user } = useAuth();
  const coordinator = user?.role === 'coord';
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState(coordinator ? '' : user?.courseId || '');
  const [directoryStatus, setDirectoryStatus] = useState<'loading' | 'ready' | 'error'>(coordinator ? 'loading' : 'ready');
  const [modules, setModules] = useState<Subject[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [retry, setRetry] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [moduleName, setModuleName] = useState('');
  const [periodName, setPeriodName] = useState('');
  const [periodId, setPeriodId] = useState('');
  const [moduleId, setModuleId] = useState('');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File>();
  const videoInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    if (!coordinator) {
      setCourseId(user?.courseId || '');
      setCourses(user?.course ? [{ id: user.courseId || '', nome: user.course.nome }] : []);
      setDirectoryStatus('ready');
      return () => controller.abort();
    }
    setDirectoryStatus('loading'); setLoadError('');
    api.get<{ courses: Course[] }>('/institution/directory', { signal: controller.signal })
      .then(response => { if (!controller.signal.aborted) { setCourses(response.data.courses); setDirectoryStatus('ready'); } })
      .catch(failure => { if (!controller.signal.aborted) { setDirectoryStatus('error'); setLoadError(failureText(failure, 'Não foi possível carregar os cursos.')); } });
    return () => controller.abort();
  }, [coordinator, user?.id, user?.courseId, retry]);
  useEffect(() => {
    const controller = new AbortController();
    setModules([]); setPeriods([]); setModuleId(''); setPeriodId(''); setStatus('loading');
    if (!courseId || directoryStatus !== 'ready') { setStatus('ready'); return () => controller.abort(); }
    setLoadError('');
    Promise.all([
      api.get<{ modules: Subject[] }>('/courses/' + encodeURIComponent(courseId), { signal: controller.signal }),
      api.get<Period[]>('/institution/periods', { signal: controller.signal }),
    ]).then(([courseResponse, periodResponse]) => {
      if (!controller.signal.aborted) { setModules(courseResponse.data.modules); setPeriods(periodResponse.data.filter(period => period.courseId === courseId)); setStatus('ready'); }
    }).catch(failure => { if (!controller.signal.aborted) { setStatus('error'); setLoadError(failureText(failure, 'Não foi possível carregar matérias e períodos.')); } });
    return () => controller.abort();
  }, [courseId, directoryStatus, retry]);
  const ready = status === 'ready' && directoryStatus === 'ready' && !!courseId;
  const begin = () => {
    if (lock.current || !ready) return false;
    lock.current = true; setBusy(true); setMessage(''); setError(''); return true;
  };
  const finish = () => { lock.current = false; setBusy(false); };
  const addPeriod = async (event: FormEvent) => {
    event.preventDefault(); if (!begin()) return;
    try {
      const created = (await api.post<Period>('/institution/periods', { nome: periodName.trim(), courseId })).data;
      setPeriods(current => [...current, created]); setPeriodId(created.id); setPeriodName(''); setMessage('Período cadastrado no curso.');
    } catch (failure) { setError(failureText(failure, 'Não foi possível salvar o período.')); }
    finally { finish(); }
  };
  const addModule = async (event: FormEvent) => {
    event.preventDefault(); if (!begin()) return;
    try {
      const created = (await api.post<Subject>('/modules', { nome: moduleName.trim(), courseId, periodId: periodId || null })).data;
      setModules(current => [...current, { ...created, lessons: created.lessons || [] }]); setModuleId(created.id); setModuleName(''); setMessage('Matéria salva no curso.');
    } catch (failure) { setError(failureText(failure, 'Não foi possível salvar a matéria.')); }
    finally { finish(); }
  };
  const addLesson = async (event: FormEvent) => {
    event.preventDefault(); if (!file || !moduleId || !begin()) return;
    try {
      const body = new FormData(); body.append('video', file);
      const video = (await api.post('/upload/video', body, { timeout: 120000 })).data.videoUrl;
      const lesson = (await api.post<Lesson>('/modules/' + encodeURIComponent(moduleId) + '/lessons', { titulo: title.trim(), videoUrl: video })).data;
      setModules(current => current.map(subject => subject.id === moduleId ? { ...subject, lessons: [...subject.lessons, lesson] } : subject));
      setTitle(''); setFile(undefined); if (videoInput.current) videoInput.current.value = ''; setMessage('Aula salva e disponível no curso.');
    } catch (failure) { setError(failureText(failure, 'Não foi possível salvar a aula. Seu formulário foi preservado.')); }
    finally { finish(); }
  };
  return <div><TopBar currentPage="Períodos, matérias e aulas" /><div className="unit-setup">
    <div className="page-head"><div><p className="eyebrow">{user?.tenant?.nome}</p><h1>Períodos, matérias e aulas</h1><p>Organize o curso por períodos, cadastre matérias e publique o conteúdo real da instituição.</p></div></div>
    {message && <p role="status" className="card">{message}</p>}{error && <p role="alert" className="inline-form-error">{error}</p>}
    {coordinator && <section className="card"><label htmlFor="managed-course"><strong>Curso que deseja gerenciar</strong></label><select id="managed-course" disabled={busy || directoryStatus !== 'ready'} value={courseId} onChange={event => { setCourseId(event.target.value); setMessage(''); setError(''); setModuleName(''); setPeriodName(''); setTitle(''); setFile(undefined); }}><option value="">Selecione um curso</option>{courses.map(course => <option key={course.id} value={course.id}>{course.nome}</option>)}</select><p className="muted">Os períodos, matérias e aulas abaixo pertencem somente ao curso selecionado.</p></section>}
    {directoryStatus === 'loading' ? <p role="status">Carregando cursos…</p> : directoryStatus === 'error' || status === 'error' ? <section className="card"><p role="alert">{loadError}</p><button className="btn" onClick={() => setRetry(value => value + 1)}>Tentar novamente</button></section> : !courseId ? <section className="card"><h2>{coordinator && courses.length ? 'Selecione um curso para começar' : 'Nenhum curso disponível'}</h2><p>{coordinator ? 'Escolha um curso acima ou cadastre o primeiro em Unidade e equipe.' : 'Peça à coordenação para vincular sua conta a um curso.'}</p></section> : status === 'loading' ? <p role="status">Carregando períodos e matérias…</p> : <>
      <div className="unit-setup-grid">
        <form className="card compact-form" onSubmit={addPeriod}><h2>Cadastrar período</h2><fieldset disabled={busy || !ready} style={{ border: 0, padding: 0, margin: 0 }}><label>Nome do período<input required maxLength={100} value={periodName} onChange={event => setPeriodName(event.target.value)} placeholder="Ex.: Primeiro semestre" /></label><button className="btn primary" disabled={busy || !periodName.trim()}>Salvar período</button></fieldset></form>
        <form className="card compact-form" onSubmit={addModule}><h2>Cadastrar matéria</h2><fieldset disabled={busy || !ready} style={{ border: 0, padding: 0, margin: 0 }}><label>Nome da matéria<input required maxLength={120} value={moduleName} onChange={event => setModuleName(event.target.value)} /></label><label>Período<select value={periodId} onChange={event => setPeriodId(event.target.value)}><option value="">Sem período</option>{periods.map(period => <option key={period.id} value={period.id}>{period.nome}</option>)}</select></label><button className="btn primary" disabled={busy || !moduleName.trim()}>Salvar matéria</button></fieldset></form>
        <form className="card compact-form" onSubmit={addLesson}><h2>Cadastrar videoaula</h2>{user?.tenant?.plan?.videoAulas === false && <p role="status">Videoaulas não estão incluídas no plano desta instituição.</p>}<fieldset disabled={busy || !ready || user?.tenant?.plan?.videoAulas === false} style={{ border: 0, padding: 0, margin: 0 }}><label>Matéria<select required value={moduleId} onChange={event => setModuleId(event.target.value)}><option value="">Selecione uma matéria</option>{modules.map(subject => <option key={subject.id} value={subject.id}>{subject.nome}</option>)}</select></label><label>Título da aula<input required maxLength={200} value={title} onChange={event => setTitle(event.target.value)} /></label><label>Arquivo de vídeo<input ref={videoInput} required type="file" accept="video/mp4,video/webm,video/quicktime" onChange={event => setFile(event.target.files?.[0])} /></label><button className="btn primary" disabled={busy || !modules.length || !title.trim() || !file}>{busy ? 'Salvando…' : 'Salvar aula'}</button></fieldset></form>
      </div>
      <section className="card"><h2>Estrutura do curso</h2>{periods.length > 0 && <p className="muted">{periods.length} {periods.length === 1 ? 'período cadastrado' : 'períodos cadastrados'}: {periods.map(period => period.nome).join(' · ')}</p>}{modules.length ? modules.map(subject => <article key={subject.id} style={{ padding: '16px 0', borderBottom: '1px solid var(--line-2)', overflowWrap: 'anywhere' }}><p className="eyebrow">{periods.find(period => period.id === subject.periodId)?.nome || 'Sem período'}</p><h3>{subject.nome}</h3>{subject.lessons.length ? subject.lessons.map(lesson => <p key={lesson.id}>{lesson.titulo}{lesson.prof ? ' · ' + lesson.prof : ''}</p>) : <p className="muted">Nenhuma aula cadastrada.</p>}</article>) : <p className="muted">Nenhuma matéria cadastrada neste curso. Crie a primeira acima.</p>}</section>
    </>}
  </div></div>;
};
