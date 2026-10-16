import React, { FormEvent, useEffect, useState } from 'react';
import api from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { TopBar } from '../../components/TopBar';

export const ContentManager: React.FC = () => {
  const { user } = useAuth();
  const [modules, setModules] = useState<any[]>([]);
  const [moduleName, setModuleName] = useState('');
  const [moduleId, setModuleId] = useState('');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const load = async () => {
    if (!user?.courseId) return;
    try { setModules((await api.get('/courses/' + user.courseId)).data.modules); }
    catch { setMessage('Não foi possível carregar as matérias. Recarregue a página para tentar novamente.'); }
  };
  useEffect(() => { void load(); }, [user?.courseId]);
  const addModule = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const created = (await api.post('/modules', { nome: moduleName })).data;
      setModules(current => [...current, { ...created, lessons: [] }]); setModuleId(created.id); setModuleName(''); setMessage('Matéria salva no curso.');
    } catch (error: any) { setMessage(error.response?.data?.error || 'Não foi possível salvar a matéria.'); }
    finally { setBusy(false); }
  };
  const addLesson = async (event: FormEvent) => {
    event.preventDefault(); if (!file) return; setBusy(true); setMessage('');
    try {
      const body = new FormData(); body.append('video', file);
      const video = (await api.post('/upload/video', body, { timeout: 120000 })).data.videoUrl;
      const lesson = (await api.post('/modules/' + moduleId + '/lessons', { titulo: title, videoUrl: video })).data;
      setModules(current => current.map(module => module.id === moduleId ? { ...module, lessons: [...(module.lessons || []), lesson] } : module));
      setTitle(''); setFile(undefined); setMessage('Aula salva e disponível no curso.');
    } catch (error: any) { setMessage(error.response?.data?.error || 'Não foi possível salvar a aula.'); }
    finally { setBusy(false); }
  };
  return <div><TopBar currentPage="Matérias e aulas" /><div className="unit-setup"><div className="page-head"><div><p className="eyebrow">{user?.tenant?.nome}</p><h1>Matérias e aulas</h1><p>Somente os conteúdos cadastrados para este curso.</p></div></div>{message && <p role="status" className="card">{message}</p>}{!user?.courseId ? <section className="card"><h2>Nenhum curso associado</h2><p>Cadastre um curso em Unidade e equipe para começar.</p></section> : <><div className="unit-setup-grid"><form className="card compact-form" onSubmit={addModule}><h2>Cadastrar matéria</h2><label>Nome da matéria<input required maxLength={120} value={moduleName} onChange={event => setModuleName(event.target.value)} /></label><button className="btn primary" disabled={busy}>Salvar matéria</button></form><form className="card compact-form" onSubmit={addLesson}><h2>Cadastrar videoaula</h2>{user?.tenant?.plan?.videoAulas === false && <p role="status">Videoaulas não estão incluídas no plano desta instituição.</p>}<fieldset disabled={busy || user?.tenant?.plan?.videoAulas === false} style={{ border: 0, padding: 0, margin: 0 }}><label>Matéria<select required value={moduleId} onChange={event => setModuleId(event.target.value)}><option value="">Selecione uma matéria</option>{modules.map(module => <option key={module.id} value={module.id}>{module.nome}</option>)}</select></label><label>Título da aula<input required maxLength={200} value={title} onChange={event => setTitle(event.target.value)} /></label><label>Arquivo de vídeo<input key={file ? 'selected' : 'empty'} required type="file" accept="video/mp4,video/webm,video/quicktime" onChange={event => setFile(event.target.files?.[0])} /></label><button className="btn primary" disabled={busy || !modules.length}>{busy ? 'Salvando…' : 'Salvar aula'}</button></fieldset></form></div><section className="card"><h2>Matérias do curso</h2>{modules.length ? modules.map(module => <article key={module.id} style={{ padding: '16px 0' }}><h3>{module.nome}</h3>{module.lessons?.length ? module.lessons.map((lesson: any) => <p key={lesson.id}>{lesson.titulo} · {lesson.prof}</p>) : <p className="muted">Nenhuma aula cadastrada.</p>}</article>) : <p className="muted">Nenhuma matéria cadastrada. Crie a primeira acima.</p>}</section></>}</div></div>;
};
