import React, { FormEvent, useEffect, useState } from 'react';
import { LiveKitRoom, VideoConference } from '@livekit/components-react';
import '@livekit/components-styles';
import { CalendarDays, Clock3, Radio, Users, Video, X } from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { TopBar } from '../../components/TopBar';
import { AppDialog } from '../../components/AppDialog';
import './CoordLive.css';

type Room = { id: string; label: string; participantCount: number; facilitatorId: string | null; facilitatorName: string | null };
type LiveSession = { id: string; title: string; startsAt: string; endsAt: string; status: 'scheduled' | 'starting' | 'live' | 'ending' | 'ended'; courseId?: string | null; classGroupId?: string | null; roomCount: number; roomSize: number; rooms?: Room[]; myRoomId?: string | null; myRoomLabel?: string | null };
type Course = { id: string; nome: string };
type ClassGroup = { id: string; nome: string; courseId: string; memberIds?: string[] };
type Facilitator = { id: string; nome: string; role: string };
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
  const [step, setStep] = useState(1);
  const [roomSize, setRoomSize] = useState(30);
  const [roomSessionId, setRoomSessionId] = useState<string | null>(null);
  const [facilitators, setFacilitators] = useState<Facilitator[]>([]);
  const [facilitatorsLoading, setFacilitatorsLoading] = useState(false);
  const [facilitatorsError, setFacilitatorsError] = useState('');
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
        } else if (user?.courseId) {
          setCourses([{ id: user.courseId, nome: user.course?.nome || 'Meu curso' }]);
          const classes = await api.get<ClassGroup[]>('/institution/classes', { signal: controller.signal });
          if (!controller.signal.aborted) setGroups(classes.data);
        }
      } catch (failure) { if (!controller.signal.aborted) setError(errorMessage(failure, 'Não foi possível carregar as aulas ao vivo.')); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load(); return () => controller.abort();
  }, [user?.id, user?.role, user?.courseId, user?.course?.nome, retry]);

  const roomSession = sessions.find(session => session.id === roomSessionId);
  useEffect(() => {
    if (!roomSession?.courseId || user?.role !== 'coord') return;
    const controller = new AbortController();
    setFacilitators([]); setFacilitatorsError(''); setFacilitatorsLoading(true);
    api.get<{ items: Facilitator[] }>('/live-sessions/facilitators', { params: { courseId: roomSession.courseId }, signal: controller.signal })
      .then(response => { if (!controller.signal.aborted) setFacilitators(response.data.items); })
      .catch(failure => { if (!controller.signal.aborted) setFacilitatorsError(errorMessage(failure, 'Não foi possível carregar os professores e monitores.')); })
      .finally(() => { if (!controller.signal.aborted) setFacilitatorsLoading(false); });
    return () => controller.abort();
  }, [roomSession?.courseId, user?.role]);

  async function refresh() { const response = await api.get<{ items: LiveSession[] }>('/live-sessions'); setSessions(response.data.items); }
  async function create(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) { setError('O término precisa ser depois do início.'); return; }
    if (!classGroupId) { setError('Selecione a turma que participará desta aula.'); return; }
    if (step === 1) { setError(''); setStep(2); return; }
    if (!Number.isInteger(roomSize) || roomSize < 10 || roomSize > 50) { setError('Defina entre 10 e 50 alunos por sala.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      await api.post('/live-sessions', { title: title.trim(), startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString(), courseId: courseId || user?.courseId || undefined, classGroupId, roomSize });
      await refresh(); setCreating(false); setTitle(''); setNotice('Aula agendada. Abra as salas e atribua um professor ou monitor a cada uma antes de iniciar.');
    } catch (failure) { setError(errorMessage(failure, 'Não foi possível agendar a aula.')); }
    finally { setBusy(false); }
  }
  async function action(session: LiveSession, operation: 'start' | 'end' | 'join', roomId?: string) {
    if (busy) return; setBusy(true); setError(''); setNotice('');
    try {
      if (operation === 'join') { const response = await api.post<Join>(`/live-sessions/${encodeURIComponent(session.id)}/join`, roomId ? { roomId } : {}); setRoomSessionId(null); setJoined(response.data); }
      else { await api.post(`/live-sessions/${encodeURIComponent(session.id)}/${operation}`); await refresh(); if (operation === 'end' && joined?.session.id === session.id) setJoined(null); setNotice(operation === 'start' ? 'Aula iniciada. Agora os participantes podem entrar.' : 'Aula encerrada.'); }
    } catch (failure) { setError(errorMessage(failure, operation === 'join' ? 'Não foi possível entrar na sala. Verifique câmera, microfone e sua conexão.' : 'Não foi possível atualizar a aula.')); }
    finally { setBusy(false); }
  }
  async function assignRoom(session: LiveSession, room: Room, facilitatorId: string) {
    if (busy) return;
    setBusy(true); setError('');
    try {
      await api.patch(`/live-sessions/${encodeURIComponent(session.id)}/rooms/${encodeURIComponent(room.id)}`, { facilitatorId: facilitatorId || null });
      await refresh(); setNotice(`Responsável de ${room.label} atualizado.`);
    } catch (failure) { setError(errorMessage(failure, 'Não foi possível atualizar o responsável da sala.')); }
    finally { setBusy(false); }
  }
  const courseName = (id?: string | null) => courses.find(course => course.id === id)?.nome;
  const selectedGroup = groups.find(group => group.id === classGroupId);
  const memberCount = selectedGroup?.memberIds?.length ?? 0;
  const previewRoomCount = memberCount ? Math.ceil(memberCount / (roomSize || 30)) : 0;
  return <><TopBar currentPage="Aulas ao vivo" /><div className="live-page">
    {joined ? <section className="live-room" aria-label={`Sala da aula ${joined.session.title}`}>
      <div className="live-room-head"><div><span className="live-kicker">AO VIVO · FACILITA ESTUDOS</span><h1>{joined.session.title}</h1></div><button className="btn" onClick={() => setJoined(null)}><X size={17} /> Sair da sala</button></div>
      {error && <p className="live-feedback live-error" role="alert">{error}</p>}
      <LiveKitRoom serverUrl={joined.url} token={joined.token} connect audio={user?.role !== 'aluno'} video={user?.role !== 'aluno'} className="live-kit" onDisconnected={() => setJoined(null)} onError={failure => setError(failure.message)}><VideoConference /></LiveKitRoom>
      <p className="live-room-hint">Seu navegador pode pedir autorização para usar câmera e microfone. Use os controles da sala para desligá-los a qualquer momento.</p>
    </section> : <>
      <header className="live-heading"><div><span className="live-kicker">SALA DE AULA DIGITAL</span><h1>Aulas ao vivo, no seu espaço.</h1><p>Encontros em salas menores, com um professor ou monitor em cada sala. Os alunos da turma são distribuídos automaticamente.</p></div><div className="live-heading-icon"><Video size={30} /></div></header>
      <div className="live-actions"><div><strong>Próximos encontros</strong><span>Somente as aulas que você pode acessar aparecem aqui.</span></div><div className="live-action-buttons"><button className="btn" onClick={() => setRetry(value => value + 1)} disabled={loading || busy}>Atualizar</button>{user?.role === 'coord' && <button className="btn primary" onClick={() => { setError(''); setStep(1); setCreating(true); }}><CalendarDays size={17} /> Agendar aula</button>}</div></div>
      {error && <p className="live-feedback live-error" role="alert">{error}</p>}{notice && <p className="live-feedback live-success" role="status">{notice}</p>}
      {loading ? <div className="live-empty" role="status">Carregando suas aulas…</div> : !sessions.length ? <div className="live-empty"><div className="live-empty-icon"><Radio size={27} /></div><h2>Nenhuma aula agendada</h2><p>{canManage ? 'Agende um encontro e organize as salas da turma.' : 'Quando sua instituição agendar uma aula, ela aparecerá aqui.'}</p></div> : <div className="live-list">{sessions.map(session => {
        const missingFacilitators = session.rooms?.filter(room => !room.facilitatorId).length ?? 0;
        return <article className="live-card" key={session.id}>
          <div className="live-date"><CalendarDays size={21} /><span>{new Date(session.startsAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span></div>
          <div className="live-card-copy"><div className="live-card-eyebrow"><span className={`live-badge live-${session.status}`}>{session.status === 'live' ? 'Em andamento' : session.status === 'starting' ? 'Preparando salas' : session.status === 'ending' ? 'Encerrando' : session.status === 'ended' ? 'Encerrada' : 'Agendada'}</span>{courseName(session.courseId) && <span>{courseName(session.courseId)}</span>}</div><h2>{session.title}</h2><p><Clock3 size={15} /> {formatDate(session.startsAt)} · até {new Date(session.endsAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p><p className="live-room-summary"><Users size={15} />{canManage ? `${session.roomCount ?? session.rooms?.length ?? 0} salas · até ${session.roomSize || 30} alunos por sala` : session.myRoomLabel || 'Sua sala será indicada pela instituição'}</p>{canManage && missingFacilitators > 0 && session.status !== 'ended' && <p className="live-pending">{missingFacilitators} {missingFacilitators === 1 ? 'sala precisa' : 'salas precisam'} de um responsável para iniciar.</p>}</div>
          <div className="live-card-actions">
            {canManage && <button className="btn" disabled={busy} onClick={() => { setError(''); if (user?.role === 'coord') setFacilitatorsLoading(true); setRoomSessionId(session.id); }}>Ver salas</button>}
            {session.status === 'scheduled' && user?.role === 'coord' && <button className="btn primary" disabled={busy || missingFacilitators > 0 || !session.rooms?.length} onClick={() => void action(session, 'start')}>Iniciar aula</button>}
            {session.status === 'starting' && user?.role === 'coord' && <button className="btn" disabled={busy} onClick={() => void action(session, 'start')}>Tentar iniciar novamente</button>}
            {session.status === 'live' && !canManage && <button className="btn primary" disabled={busy || !session.myRoomId} onClick={() => void action(session, 'join')}>Entrar na minha sala</button>}
            {session.status === 'live' && user?.role === 'coord' && <button className="btn" disabled={busy} onClick={() => void action(session, 'end')}>Encerrar aula</button>}
            {session.status === 'ending' && user?.role === 'coord' && <button className="btn" disabled={busy} onClick={() => void action(session, 'end')}>Tentar encerrar novamente</button>}
          </div>
        </article>;
      })}</div>}
    </>}
    {creating && <AppDialog title={step === 1 ? 'Agendar encontro' : 'Organizar as salas'} eyebrow="NOVA AULA" busy={busy} focusKey={step} onClose={() => setCreating(false)}>
      <ol className="live-steps" aria-label="Etapas do agendamento"><li aria-current={step === 1 ? 'step' : undefined}><span>1</span> Encontro</li><li aria-current={step === 2 ? 'step' : undefined}><span>2</span> Divisão da turma</li></ol>
      <form className="live-schedule-form" onSubmit={event => void create(event)}>
        {step === 1 ? <><label>Título da aula<input required maxLength={120} value={title} onChange={event => setTitle(event.target.value)} placeholder="Ex.: Revisão do semestre" /></label><label>Curso<select required value={courseId || user?.courseId || ''} onChange={event => { setCourseId(event.target.value); setClassGroupId(''); }}><option value="">Selecione um curso</option>{courses.map(course => <option key={course.id} value={course.id}>{course.nome}</option>)}</select></label><label>Turma<select required value={classGroupId} onChange={event => setClassGroupId(event.target.value)}><option value="">Selecione uma turma</option>{groups.filter(group => group.courseId === (courseId || user?.courseId)).map(group => <option key={group.id} value={group.id}>{group.nome}</option>)}</select></label>{!(groups.some(group => group.courseId === (courseId || user?.courseId))) && <p>Cadastre uma turma neste curso antes de agendar a aula.</p>}<div className="live-dialog-dates"><label>Início<input required type="datetime-local" value={startsAt} onChange={event => setStartsAt(event.target.value)} /></label><label>Término<input required type="datetime-local" value={endsAt} onChange={event => setEndsAt(event.target.value)} /></label></div></> : <><div className="live-meeting-recap"><strong>{title}</strong><span>{selectedGroup?.nome} · {formatDate(startsAt)}</span></div><label>Máximo de alunos por sala<input required type="number" min={10} max={50} step={1} value={roomSize || ''} onChange={event => setRoomSize(Number(event.target.value))} aria-describedby="live-capacity-hint" /></label><p id="live-capacity-hint">Entre 10 e 50 alunos. Cada sala terá seu próprio professor ou monitor.</p><div className="live-capacity-preview" aria-live="polite"><Users size={25} /><div><strong>{previewRoomCount ? `${previewRoomCount} ${previewRoomCount === 1 ? 'sala prevista' : 'salas previstas'}` : 'Divisão automática'}</strong><span>{memberCount ? `${memberCount} participantes cadastrados na turma · até ${roomSize || 30} alunos por sala` : 'A quantidade de salas será calculada com os alunos ativos da turma.'}</span></div></div><p>Após agendar, atribua um responsável a cada sala. A aula só poderá começar quando todas estiverem configuradas.</p></>}
        {error && <p className="live-feedback live-error" role="alert">{error}</p>}
        <div className="app-dialog-actions"><button className="btn" type="button" onClick={() => step === 2 ? setStep(1) : setCreating(false)} disabled={busy}>{step === 2 ? 'Voltar' : 'Cancelar'}</button><button className="btn primary" disabled={busy || !courses.length}>{busy ? 'Agendando…' : step === 1 ? 'Próxima etapa' : 'Agendar e criar salas'}</button></div>
      </form>
    </AppDialog>}
    {roomSession && <AppDialog title={roomSession.title} eyebrow="SALAS DA AULA" description="Um professor ou monitor acompanha cada sala. Os alunos entram automaticamente na sala atribuída a eles." wide busy={busy} onClose={() => setRoomSessionId(null)}>
      {error && <p className="live-feedback live-error" role="alert">{error}</p>}{facilitatorsError && <p className="live-feedback live-error" role="alert">{facilitatorsError}</p>}
      {facilitatorsLoading && <p role="status">Carregando responsáveis…</p>}
      {user?.role === 'coord' && !facilitatorsLoading && !facilitatorsError && !facilitators.length && roomSession.status === 'scheduled' && <p className="live-feedback">Cadastre professores ou monitores neste curso e conceda a permissão de gerenciar aulas ao vivo para atribuí-los às salas.</p>}
      <div className="live-breakout-list">{roomSession.rooms?.map(room => <section key={room.id} className="live-breakout"><div className="live-breakout-title"><Users size={20} /><div><h3>{room.label}</h3><p>{room.participantCount} alunos{room.facilitatorName ? ` · ${room.facilitatorName}` : ' · Sem responsável'}</p></div></div><div className="live-breakout-controls">{user?.role === 'coord' && roomSession.status === 'scheduled' && <label>Professor ou monitor<select aria-label={`Responsável de ${room.label}`} value={room.facilitatorId || ''} disabled={busy || facilitatorsLoading || !!facilitatorsError} onChange={event => void assignRoom(roomSession, room, event.target.value)}><option value="">Sem responsável</option>{room.facilitatorId && !facilitators.some(person => person.id === room.facilitatorId) && <option value={room.facilitatorId}>{room.facilitatorName || 'Responsável atual'}</option>}{facilitators.map(person => <option key={person.id} value={person.id} disabled={roomSession.rooms?.some(other => other.id !== room.id && other.facilitatorId === person.id)}>{person.nome} · {person.role === 'coord' ? 'Coordenação' : 'Professor / monitor'}{roomSession.rooms?.some(other => other.id !== room.id && other.facilitatorId === person.id) ? ' (em outra sala)' : ''}</option>)}</select></label>}{roomSession.status === 'live' && (user?.role === 'coord' || room.facilitatorId === user?.id) && <button className="btn primary" disabled={busy || !room.facilitatorId} onClick={() => void action(roomSession, 'join', room.id)}>Entrar nesta sala</button>}</div></section>)}</div>
      {!roomSession.rooms?.length && <p className="live-feedback">Esta aula ainda não possui salas. Atualize a lista ou agende um novo encontro com uma turma.</p>}
    </AppDialog>}
  </div></>;
};
