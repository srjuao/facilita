import React, { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, CalendarDays, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import api from '../../api/client';
import { TopBar } from '../../components/TopBar';
import './StudentPeriods.css';

type Period = { id: string; nome: string; courseId: string };
type Course = { id: string; nome: string; modules: { id: string; periodId?: string | null; lessons: { id: string; completed?: boolean }[] }[] };
type Props = { onNavigateLesson?: (lessonId: string) => void; onNavigateView?: (view: string) => void };

export const StudentPeriods: React.FC<Props> = ({ onNavigateView }) => {
  const { user } = useAuth();
  const courseId = user?.courseId;
  const [periods, setPeriods] = useState<Period[]>([]);
  const [course, setCourse] = useState<Course | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setPeriods([]);
    setCourse(null);
    setError('');
    if (!courseId) {
      setStatus('ready');
      return () => controller.abort();
    }
    setStatus('loading');
    Promise.all([
      api.get<Period[]>('/institution/periods', { params: { courseId }, signal: controller.signal }),
      api.get<Course>(`/courses/${encodeURIComponent(courseId)}`, { signal: controller.signal }),
    ]).then(([periodResponse, courseResponse]) => {
      if (controller.signal.aborted) return;
      setPeriods(periodResponse.data.filter(period => period.courseId === courseId));
      setCourse(courseResponse.data);
      setStatus('ready');
    }).catch((cause) => {
      if (controller.signal.aborted) return;
      setError(cause.response?.data?.error || 'Não foi possível carregar os períodos do curso.');
      setStatus('error');
    });
    return () => controller.abort();
  }, [courseId, user?.id, retry]);

  const summaries = periods.map(period => {
    const modules = course?.modules.filter(module => module.periodId === period.id) || [];
    const total = modules.reduce((count, module) => count + module.lessons.length, 0);
    const completed = modules.reduce((count, module) => count + module.lessons.filter(lesson => lesson.completed).length, 0);
    return { period, subjects: modules.length, total, completed };
  });
  const totalLessons = summaries.reduce((count, item) => count + item.total, 0);
  const completedLessons = summaries.reduce((count, item) => count + item.completed, 0);

  return <div><TopBar currentPage="Períodos" /><main className="unit-setup student-periods">
    <header className="student-periods-head">
      <div><p className="eyebrow">{user?.tenant?.nome || 'Minha instituição'}{course?.nome ? ` · ${course.nome}` : ''}</p><h1>Períodos do curso</h1><p>Veja a organização do curso e o que você já concluiu em cada etapa.</p></div>
      {course && <div className="student-periods-summary" aria-label={`Progresso geral: ${completedLessons} de ${totalLessons} aulas concluídas`}><span>Progresso geral</span><strong>{completedLessons}<small> / {totalLessons} aulas</small></strong></div>}
    </header>
    {!courseId ? <section className="student-periods-empty"><CalendarDays size={26} aria-hidden="true" /><h2>Você ainda não está vinculado a um curso</h2><p>Peça à coordenação para associar sua conta a um curso. Os períodos aparecerão aqui.</p></section>
      : status === 'loading' ? <p role="status" className="student-periods-state">Carregando períodos…</p>
      : status === 'error' ? <section className="student-periods-empty" role="alert"><h2>Não foi possível abrir os períodos</h2><p>{error}</p><button className="btn" onClick={() => setRetry(value => value + 1)}>Tentar novamente</button></section>
      : !summaries.length ? <section className="student-periods-empty"><CalendarDays size={26} aria-hidden="true" /><h2>Nenhum período cadastrado</h2><p>A instituição ainda não organizou este curso em períodos.</p></section>
      : <ol className="student-periods-list">{summaries.map(({ period, subjects, total, completed }, index) => {
        const percent = total ? Math.round(completed / total * 100) : 0;
        return <li key={period.id} className="student-periods-item"><div className="student-periods-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</div><div className="student-periods-content"><div className="student-periods-title"><div><span className="student-periods-kicker">ETAPA {index + 1}</span><h2>{period.nome}</h2></div>{total > 0 && completed === total && <span className="student-periods-done"><CheckCircle2 size={16} aria-hidden="true" /> Aulas concluídas</span>}</div><div className="student-periods-meta"><span><BookOpen size={15} aria-hidden="true" /> {subjects} {subjects === 1 ? 'matéria' : 'matérias'}</span><span>{completed} de {total} {total === 1 ? 'aula concluída' : 'aulas concluídas'}</span></div><div className="student-periods-progress" role="progressbar" aria-label={`Progresso de ${period.nome}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><span style={{ width: `${percent}%` }} /></div>{subjects === 0 && <p className="student-periods-note">As matérias deste período ainda não foram publicadas.</p>}</div></li>;
      })}</ol>}
    {status === 'ready' && course && <div className="student-periods-next"><div><strong>Quer continuar estudando?</strong><p>As aulas e atividades ficam organizadas na página de matérias.</p></div><button className="btn primary" onClick={() => onNavigateView?.('al-materias')}>Abrir matérias <ArrowRight size={16} aria-hidden="true" /></button></div>}
  </main></div>;
};
