import React, { FormEvent, useEffect, useState } from 'react';
import { LiveKitRoom, VideoConference } from '@livekit/components-react';
import '@livekit/components-styles';
import { CalendarDays, Clock3, Radio, Video, X } from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { TopBar } from '../../components/TopBar';
import './CoordLive.css';

type LiveSession = { id: string; title: string; startsAt: string; endsAt: string; status: 'scheduled' | 'starting' | 'live' | 'ending' | 'ended'; courseId?: string | null; classGroupId?: string | null };
type Course = { id: string; nome: string };
type ClassGroup = { id: string; nome: string; courseId: string };
type Join = { url: string; token: string; roomName: string; session: LiveSession };
const errorMessage = (error: unknown, fallback: string) => (error as { response?: { data?: { error?: string; message?: string } } })?.response?.data?.error || (error as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;
const formatDate = (value: string) => new Date(value).toLocaleString('pt-BR', { dateStyle: 'medium', timeStyle: 'short' });
const localDateTime = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export const CoordLive: React.FC = () => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [groups, setGroups] = useState<ClassGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [retry, setRetry] = useState(0);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [courseId, setCourseId] = useState('');
  const [classGroupId, setClassGroupId] = useState('');
  const [startsAt, setStartsAt] = useState(localDateTime(new Date(Date.now() + 3600000)));
  const [endsAt, setEndsAt] = useState(localDateTime(new Date(Date.now() + 7200000)));
  const [joined, setJoined] = useState<Join | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const canManage = user?.role === 'coord' || (user?.role === 'professor' && permissions.includes('live.manage'));

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    async function load() {
      try {
        const [list, access] = await Promise.all([
          api.get<{ items: LiveSession[] }>('/live-sessions', { signal: controller.signal }),
          api.get<{ permissions: string[] }>('/institution/access', { signal: controller.signal }),
        ]);
        if (controller.signal.aborted) return;
        setSessions(list.data.items); setPermissions(access.data.permissions);
        if (user?.role === 'coord') {
          const directory = await api.get<{ courses: Course[] }>('/institution/directory', { signal: controller.signal });
          if (!controller.signal.aborted) setCourses(directory.data.courses);
          const classes = await api.get<ClassGroup[]>('/institution/classes', { signal: controller.signal });
          if (!controller.signal.aborted) setGroups(classes.data);
        } else if (user?.courseId) setCourses([{ id: user.courseId, nome: user.course?.nome || 'Meu curso' }]);
      } catch (failure) { if (!controller.signal.aborted) setError(errorMessage(failure, 'Não foi possível carregar as aulas ao vivo.')); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load(); return () => controller.abort();
  }, [user?.id, user?.role, user?.courseId, user?.course?.nome, retry]);

  async function refresh() { const response = await api.get<{ items: LiveSession[] }>('/live-sessions'); setSessions(response.data.items); }
  async function create(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) { setError('O término precisa ser depois do início.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      await api.post('/live-sessions', { title: title.trim(), startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString(), courseId: courseId || user?.courseId || undefined, classGroupId: classGroupId || undefined });
      await refresh(); setCreating(false); setTitle(''); setNotice('Aula agendada. Os participantes autorizados já podem vê-la.');
    } catch (failure) { setError(errorMessage(failure, 'Não foi possível agendar a aula.')); }
    finally { setBusy(false); }
  }
  async function action(session: LiveSession, operation: 'start' | 'end' | 'join') {
    if (busy) return; setBusy(true); setError(''); setNotice('');
    try {
      if (operation === 'join') { const response = await api.post<Join>(`/live-sessions/${encodeURIComponent(session.id)}/join`); setJoined(response.data); }
      else { await api.post(`/live-sessions/${encodeURIComponent(session.id)}/${operation}`); await refresh(); if (operation === 'end' && joined?.session.id === session.id) setJoined(null); setNotice(operation === 'start' ? 'Aula iniciada. Agora os participantes podem entrar.' : 'Aula encerrada.'); }
    } catch (failure) { setError(errorMessage(failure, operation === 'join' ? 'Não foi possível entrar na sala. Verifique câmera, microfone e sua conexão.' : 'Não foi possível atualizar a aula.')); }
    finally { setBusy(false); }
  }
  const courseName = (id?: string | null) => courses.find(course => course.id === id)?.nome;
  return <><TopBar currentPage="Aulas ao vivo" /><div className="live-page">
    {joined ? <section className="live-room" aria-label={`Sala da aula ${joined.session.title}`}>
      <div className="live-room-head"><div><span className="live-kicker">AO VIVO · FACILITA ESTUDOS</span><h1>{joined.session.title}</h1></div><button className="btn" onClick={() => setJoined(null)}><X size={17} /> Sair da sala</button></div>
      {error && <p className="live-feedback live-error" role="alert">{error}</p>}
      <LiveKitRoom serverUrl={joined.url} token={joined.token} connect audio={user?.role !== 'aluno'} video={user?.role !== 'aluno'} className="live-kit" onDisconnected={() => setJoined(null)} onError={failure => setError(failure.message)}><VideoConference /></LiveKitRoom>
      <p className="live-room-hint">Seu navegador pode pedir autorização para usar câmera e microfone. Use os controles da sala para desligá-los a qualquer momento.</p>
    </section> : <>
      <header className="live-heading"><div><span className="live-kicker">SALA DE AULA DIGITAL</span><h1>Aulas ao vivo, no seu espaço.</h1><p>Encontros em tempo real para professores e alunos da sua instituição. Cada sala pertence ao curso ou à turma indicada.</p></div><div className="live-heading-icon"><Video size={30} /></div></header>
      <div className="live-actions"><div><strong>Próximos encontros</strong><span>Somente as aulas que você pode acessar aparecem aqui.</span></div><div className="live-action-buttons"><button className="btn" onClick={() => setRetry(value => value + 1)} disabled={loading || busy}>Atualizar</button>{user?.role === 'coord' && <button className="btn primary" onClick={() => { setError(''); setCreating(true); }}><CalendarDays size={17} /> Agendar aula</button>}</div></div>
      {error && <p className="live-feedback live-error" role="alert">{error}</p>}{notice && <p className="live-feedback live-success" role="status">{notice}</p>}
      {loading ? <div className="live-empty" role="status">Carregando suas aulas…</div> : !sessions.length ? <div className="live-empty"><div className="live-empty-icon"><Radio size={27} /></div><h2>Nenhuma aula agendada</h2><p>{canManage ? 'Comece agendando uma aula para seu curso ou turma.' : 'Quando sua instituição agendar uma aula, ela aparecerá aqui.'}</p></div> : <div className="live-list">{sessions.map(session => <article className="live-card" key={session.id}><div className="live-date"><CalendarDays size={21} /><span>{new Date(session.startsAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span></div><div className="live-card-copy"><div className="live-card-eyebrow"><span className={`live-badge live-${session.status}`}>{session.status === 'live' ? 'Em andamento' : session.status === 'starting' ? 'Preparando sala' : session.status === 'ending' ? 'Encerrando' : session.status === 'ended' ? 'Encerrada' : 'Agendada'}</span>{courseName(session.courseId) && <span>{courseName(session.courseId)}</span>}</div><h2>{session.title}</h2><p><Clock3 size={15} /> {formatDate(session.startsAt)} · até {new Date(session.endsAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p></div><div className="live-card-actions">{session.status === 'scheduled' && canManage && <button className="btn primary" disabled={busy} onClick={() => void action(session, 'start')}>Iniciar aula</button>}{session.status === 'starting' && canManage && <button className="btn" disabled={busy} onClick={() => void action(session, 'start')}>Tentar iniciar novamente</button>}{session.status === 'live' && <button className="btn primary" disabled={busy} onClick={() => void action(session, 'join')}>Entrar na sala</button>}{session.status === 'live' && canManage && <button className="btn" disabled={busy} onClick={() => void action(session, 'end')}>Encerrar</button>}{session.status === 'ending' && canManage && <button className="btn" disabled={busy} onClick={() => void action(session, 'end')}>Tentar encerrar novamente</button>}</div></article>)}</div>}
    </>}
    {creating && <div className="live-dialog-backdrop"><div className="live-dialog" role="dialog" aria-modal="true" aria-labelledby="live-dialog-title"><div className="live-dialog-head"><div><span className="live-kicker">NOVA AULA</span><h2 id="live-dialog-title">Agendar encontro</h2></div><button className="live-close" aria-label="Fechar" onClick={() => setCreating(false)} disabled={busy}><X size={20} /></button></div><form onSubmit={event => void create(event)}><label>Título da aula<input autoFocus required maxLength={120} value={title} onChange={event => setTitle(event.target.value)} placeholder="Ex.: Revisão de fisiologia" /></label><label>Curso<select required value={courseId || user?.courseId || ''} onChange={event => { setCourseId(event.target.value); setClassGroupId(''); }}><option value="">Selecione um curso</option>{courses.map(course => <option key={course.id} value={course.id}>{course.nome}</option>)}</select></label><label>Turma (opcional)<select value={classGroupId} onChange={event => setClassGroupId(event.target.value)}><option value="">Todo o curso</option>{groups.filter(group => group.courseId === (courseId || user?.courseId)).map(group => <option key={group.id} value={group.id}>{group.nome}</option>)}</select></label><div className="live-dialog-dates"><label>Início<input required type="datetime-local" value={startsAt} onChange={event => setStartsAt(event.target.value)} /></label><label>Término<input required type="datetime-local" value={endsAt} onChange={event => setEndsAt(event.target.value)} /></label></div><p>A aula só fica disponível para entrar depois que um responsável iniciá-la.</p>{error && <p className="live-feedback live-error" role="alert">{error}</p>}<div className="live-dialog-actions"><button className="btn" type="button" onClick={() => setCreating(false)} disabled={busy}>Cancelar</button><button className="btn primary" disabled={busy || !courses.length}>{busy ? 'Agendando…' : 'Agendar aula'}</button></div></form></div></div>}
  </div></>;
};
