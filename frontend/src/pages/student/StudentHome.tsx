import React, { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, CalendarDays, BarChart3 as ChartNoAxesCombined, ClipboardList, RotateCcw } from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { TopBar } from '../../components/TopBar';
import './StudentHome.css';

type Lesson = { id: string; completed?: boolean; locked?: boolean };
type Module = { id: string; nome: string; lessons: Lesson[] };
type Course = { id: string; nome: string; modules: Module[] };
type Exam = { id: string; nome: string; attemptCount?: number; maxAttempts: number };
type Result = { id: string; score: number; passed: boolean; createdAt: string; exam: { id: string; nome: string; course?: { id: string } } };
type Session = { id: string; title: string; startsAt: string; status: string; courseId?: string | null };
type Dashboard = { course: Course; exams: Exam[] | null; results: Result[] | null; sessions: Session[] | null };
const errorText = (error: unknown) => (error as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Não foi possível carregar o seu curso.';

export const StudentHome: React.FC<{ onNavigate?: (view: string) => void }> = ({ onNavigate }) => {
  const { user } = useAuth();
  const courseId = user?.courseId;
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError(''); setLoading(Boolean(courseId));
    if (!courseId) return () => controller.abort();
    const id = encodeURIComponent(courseId);
    async function load() {
      try {
        const course = await api.get<Course>(`/courses/${id}`, { signal: controller.signal });
        const [exams, results, sessions] = await Promise.allSettled([
          api.get<{ exams: Exam[] }>(`/assessments/courses/${id}/exams`, { signal: controller.signal }),
          api.get<{ attempts: Result[] }>('/assessments/my-results', { signal: controller.signal }),
          api.get<{ items: Session[] }>('/live-sessions', { signal: controller.signal }),
        ]);
        if (!controller.signal.aborted) setData({
          course: course.data,
          exams: exams.status === 'fulfilled' ? exams.value.data.exams : null,
          results: results.status === 'fulfilled' ? results.value.data.attempts.filter(item => item.exam.course?.id === courseId) : null,
          sessions: sessions.status === 'fulfilled' ? sessions.value.data.items.filter(item => !item.courseId || item.courseId === courseId) : null,
        });
      } catch (cause) { if (!controller.signal.aborted) setError(errorText(cause)); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [courseId, user?.id, retry]);

  const modules = data?.course.modules || [];
  const lessons = modules.flatMap(module => module.lessons);
  const completed = lessons.filter(lesson => lesson.completed).length;
  const progress = lessons.length ? Math.round(completed / lessons.length * 100) : 0;
  const latestResults = new Map<string, Result>();
  for (const item of data?.results || []) if (!latestResults.has(item.exam.id)) latestResults.set(item.exam.id, item);
  const passedExams = new Set((data?.results || []).filter(result => result.passed).map(result => result.exam.id));
  const pendingExams = data?.exams?.filter(exam => !passedExams.has(exam.id) && (exam.attemptCount || 0) < exam.maxAttempts) || [];
  const reinforce = [...latestResults.values()].filter(item => !item.passed).slice(0, 3);
  const now = new Date();
  const monthSessions = (data?.sessions || []).filter(item => {
    const date = new Date(item.startsAt);
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && item.status !== 'ended';
  }).sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  const monthLabel = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const nextModule = modules.find(module => module.lessons.some(lesson => !lesson.completed && !lesson.locked));

  return <div><TopBar currentPage="Meu painel" /><main className="unit-setup student-home">
    <header className="student-home-header"><div><p className="eyebrow">{user?.tenant?.nome || 'Minha instituição'} · {data?.course.nome || user?.course?.nome || 'Meu curso'}</p><h1>Seu painel de estudos</h1><p>Seu progresso, próximas atividades e pontos para reforçar em um só lugar.</p></div><button className="btn primary" onClick={() => onNavigate?.('al-materias')}>Continuar estudando <ArrowRight size={17} aria-hidden="true" /></button></header>
    {!courseId ? <section className="card student-home-empty"><BookOpen size={29} aria-hidden="true" /><h2>Seu curso ainda não foi vinculado</h2><p>Peça à coordenação para associar sua conta a um curso. Seu painel aparecerá aqui.</p></section>
      : loading ? <p role="status" className="student-home-state">Carregando seu painel…</p>
      : error ? <section className="card student-home-empty" role="alert"><h2>Não foi possível abrir o painel</h2><p>{error}</p><button className="btn" onClick={() => setRetry(value => value + 1)}><RotateCcw size={16} aria-hidden="true" /> Tentar novamente</button></section>
      : data && <>
        <section className="student-home-kpis" aria-label="Resumo do curso"><article className="card"><span>Aulas concluídas</span><strong>{completed}<small> / {lessons.length}</small></strong><p>Progresso do curso</p></article><article className="card"><span>Progresso geral</span><strong>{progress}%</strong><div className="student-home-meter" role="progressbar" aria-label="Progresso do curso" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: `${progress}%` }} /></div></article><article className="card"><span>Avaliações para fazer</span><strong>{data.exams ? pendingExams.length : '—'}</strong><p>{data.exams ? 'Tentativas disponíveis' : 'Informação indisponível'}</p></article></section>
        <div className="student-home-grid"><section className="card student-home-panel"><div className="student-home-title"><ChartNoAxesCombined size={20} aria-hidden="true" /><div><h2>Progresso por matéria</h2><p>Aulas concluídas em cada matéria do curso.</p></div></div>{modules.length ? <div className="student-home-bars">{modules.map(module => { const done = module.lessons.filter(lesson => lesson.completed).length; const pct = module.lessons.length ? Math.round(done / module.lessons.length * 100) : 0; return <div className="student-home-bar" key={module.id}><div><strong>{module.nome}</strong><span>{done}/{module.lessons.length} aulas · {pct}%</span></div><div role="progressbar" aria-label={`Progresso de ${module.nome}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><span style={{ width: `${pct}%` }} /></div></div>; })}</div> : <p className="student-home-muted">Ainda não há matérias publicadas neste curso.</p>}</section>
          <section className="card student-home-panel"><div className="student-home-title"><CalendarDays size={20} aria-hidden="true" /><div><h2>Aulas ao vivo em {monthLabel}</h2><p>Somente aulas com data marcada aparecem aqui.</p></div></div>{data.sessions === null ? <p className="student-home-muted">Agenda temporariamente indisponível.</p> : monthSessions.length ? <div className="student-home-list">{monthSessions.slice(0, 5).map(item => <div key={item.id}><time dateTime={item.startsAt}>{new Date(item.startsAt).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</time><strong>{item.title}</strong></div>)}</div> : <p className="student-home-muted">Nenhuma aula ao vivo marcada para este mês.</p>}<button className="student-home-link" onClick={() => onNavigate?.('al-live')}>Ver aulas ao vivo <ArrowRight size={15} aria-hidden="true" /></button></section>
          <section className="card student-home-panel"><div className="student-home-title"><ClipboardList size={20} aria-hidden="true" /><div><h2>Próximas atividades</h2><p>Sem prazo inventado: siga a sequência liberada pela instituição.</p></div></div>{nextModule ? <div className="student-home-next"><span>PRÓXIMA AULA</span><strong>{nextModule.nome}</strong><p>Há uma aula liberada esperando por você.</p><button className="student-home-link" onClick={() => onNavigate?.('al-materias')}>Abrir matéria <ArrowRight size={15} aria-hidden="true" /></button></div> : <p className="student-home-muted">Nenhuma aula liberada pendente no momento.</p>}{data.exams === null ? <p className="student-home-muted">Avaliações temporariamente indisponíveis.</p> : pendingExams.length > 0 && <div className="student-home-next"><span>AVALIAÇÕES</span><strong>{pendingExams.length} {pendingExams.length === 1 ? 'avaliação disponível' : 'avaliações disponíveis'}</strong><p>{pendingExams.slice(0, 2).map(item => item.nome).join(' · ')}</p><button className="student-home-link" onClick={() => onNavigate?.('al-provas')}>Abrir avaliações <ArrowRight size={15} aria-hidden="true" /></button></div>}</section>
          <section className="card student-home-panel"><div className="student-home-title"><ChartNoAxesCombined size={20} aria-hidden="true" /><div><h2>Resultados e reforço</h2><p>Baseado nas suas avaliações realizadas.</p></div></div>{data.results === null ? <p className="student-home-muted">Resultados temporariamente indisponíveis.</p> : data.results.length ? <><div className="student-home-scores">{data.results.slice(0, 5).reverse().map(item => <div key={item.id} title={`${item.exam.nome}: ${item.score.toLocaleString('pt-BR')} de 10`}><span style={{ height: `${Math.max(6, Math.min(100, item.score * 10))}%` }} className={item.passed ? 'passed' : 'needs-work'} /><small>{item.score.toLocaleString('pt-BR')}</small></div>)}</div>{reinforce.length ? <div className="student-home-reinforce"><strong>Vale revisar</strong>{reinforce.map(item => <p key={item.id}>{item.exam.nome} · nota {item.score.toLocaleString('pt-BR')}/10</p>)}</div> : <p className="student-home-muted">Você atingiu a nota mínima nas avaliações recentes.</p>}</> : <p className="student-home-muted">Faça uma avaliação para ver seu desempenho e identificar o que revisar.</p>}{data.results?.length ? <button className="student-home-link" onClick={() => onNavigate?.('al-provas')}>Ver histórico completo <ArrowRight size={15} aria-hidden="true" /></button> : null}</section></div>
      </>}
  </main></div>;
};
