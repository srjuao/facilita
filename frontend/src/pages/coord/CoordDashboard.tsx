import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, BookOpen, GraduationCap, ReceiptText, RefreshCcw, Users } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { TopBar } from '../../components/TopBar';
import api from '../../api/client';
import './CoordDashboard.css';

type Course = { id: string; nome: string };
type Subject = { id: string; name: string; courseName: string; lessons: number; completedLessons: number; possibleCompletions: number; completionPercent: number | null; averageScore: number | null; gradedStudents: number; standout: { userId: string; name: string; score: number }[] };
type FinanceMonth = { month: string; issuedCents: number; receivedCents: number; openCents: number };
type AssessmentMonth = { month: string; attempts: number; approved: number };
type Dashboard = { courses: Course[]; totals: { students: number; subjects: number; lessons: number; upcomingSessions: number; overdueInvoices: number }; subjects: Subject[]; assessment: AssessmentMonth[]; finance: FinanceMonth[]; financialNotice: string };
const money = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const monthLabel = (month: string) => new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' }).format(new Date(`${month}-01T12:00:00Z`)).replace('.', '');
const errorText = (e: unknown) => (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Não foi possível atualizar os indicadores.';

export const CoordDashboard: React.FC<{ onNavigate: (view: string) => void }> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [data, setData] = useState<Dashboard | null>(null);
  const [courseId, setCourseId] = useState('');
  const [months, setMonths] = useState<3 | 6 | 12>(6);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'progress' | 'score' | 'name'>('progress');
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const requestId = useRef(0);
  const load = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setStatus('loading'); setError('');
    try { const response = await api.get<Dashboard>('/coord/dashboard', { params: { ...(courseId ? { courseId } : {}), months } }); if (currentRequest === requestId.current) { setData(response.data); setStatus('ready'); } }
    catch (failure) { if (currentRequest === requestId.current) { setError(errorText(failure)); setStatus('error'); } }
  }, [courseId, months]);
  useEffect(() => { void load(); }, [load, user?.id]);

  const subjects = useMemo(() => (data?.subjects ?? []).filter(s => `${s.name} ${s.courseName}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())).sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'score' ? (b.averageScore ?? -1) - (a.averageScore ?? -1) : (b.completionPercent ?? -1) - (a.completionPercent ?? -1)), [data?.subjects, search, sort]);
  const issued = data?.finance.reduce((sum, item) => sum + item.issuedCents, 0) ?? 0;
  const received = data?.finance.reduce((sum, item) => sum + item.receivedCents, 0) ?? 0;
  const maximum = Math.max(1, ...(data?.finance ?? []).flatMap(item => [item.issuedCents, item.receivedCents]));
  const attempts = data?.assessment.reduce((sum, item) => sum + item.attempts, 0) ?? 0;
  const approved = data?.assessment.reduce((sum, item) => sum + item.approved, 0) ?? 0;

  return <><TopBar currentPage="Visão geral" /><main className="coord-overview">
    <header className="coord-overview-head"><div><p className="eyebrow">GESTÃO · {user?.tenant?.nome || 'INSTITUIÇÃO'}</p><h1>Visão geral da instituição</h1><p>Alunos, aprendizagem e cobranças em um só lugar.</p></div><button className="btn coord-refresh" onClick={() => void load()} disabled={status === 'loading'}><RefreshCcw size={16} aria-hidden="true" /> Atualizar</button></header>
    <div className="coord-overview-filters"><label>Curso<select value={courseId} onChange={event => setCourseId(event.target.value)}><option value="">Todos os cursos</option>{data?.courses.map(course => <option key={course.id} value={course.id}>{course.nome}</option>)}</select></label><label>Período<select value={months} onChange={event => setMonths(Number(event.target.value) as 3 | 6 | 12)}><option value={3}>Últimos 3 meses</option><option value={6}>Últimos 6 meses</option><option value={12}>Últimos 12 meses</option></select></label><small>Os filtros afetam todos os indicadores abaixo.</small></div>
    {status === 'loading' && <div className="coord-state" role="status">Carregando indicadores da instituição…</div>}
    {status === 'error' && <div className="coord-state coord-state-error" role="alert">{error} <button className="btn" onClick={() => void load()}>Tentar novamente</button></div>}
    {status === 'ready' && data && <>
      <section className="coord-kpis" aria-label="Indicadores principais"><Kpi icon={<Users />} label="Alunos ativos" value={String(data.totals.students)} detail="Contas ativas" /><Kpi icon={<BookOpen />} label="Matérias" value={String(data.totals.subjects)} detail={`${data.totals.lessons} aulas disponíveis`} /><Kpi icon={<GraduationCap />} label="Aproveitamento nas provas" value={attempts ? `${Math.round(approved / attempts * 100)}%` : '—'} detail={attempts ? `${approved} aprovações em ${attempts} tentativas` : 'Sem provas realizadas no período'} /><Kpi icon={<ReceiptText />} label="Recebido no período" value={money(received)} detail={`${data.totals.overdueInvoices} faturas vencidas`} /></section>
      <div className="coord-panels"><section className="coord-panel"><PanelTitle eyebrow="FINANCEIRO" title="Faturamento por mês" subtitle="Emissões por competência e recebimentos pela data da baixa manual." action="Abrir financeiro" onClick={() => onNavigate('co-finance')} />{issued || received ? <><div className="coord-finance-totals"><span>Emitido <strong>{money(issued)}</strong></span><span>Recebido <strong>{money(received)}</strong></span><span>Em aberto <strong>{money(data.finance.reduce((sum, item) => sum + item.openCents, 0))}</strong></span></div><div className="coord-bar-chart" role="img" aria-label={`Emitido: ${money(issued)}. Recebido: ${money(received)}.`}>{data.finance.map(item => <div className="coord-bar-month" key={item.month} title={`${item.month}: ${money(item.issuedCents)} emitidos; ${money(item.receivedCents)} recebidos`}><div className="coord-bars"><i style={{ height: `${item.issuedCents / maximum * 100}%` }} /><i style={{ height: `${item.receivedCents / maximum * 100}%` }} /></div><span>{monthLabel(item.month)}</span></div>)}</div><div className="coord-chart-legend"><span>■ Emitido</span><span>■ Recebido</span></div></> : <Empty>Nenhuma fatura emitida ou recebida no período selecionado.</Empty>}</section>
      <section className="coord-panel"><PanelTitle eyebrow="APRENDIZAGEM" title="Ritmo da instituição" subtitle="Aulas e avaliações realizadas de verdade." /><div className="coord-academic-metrics"><div><span>Aulas concluídas</span><strong>{data.subjects.reduce((sum, subject) => sum + subject.completedLessons, 0).toLocaleString('pt-BR')}</strong><small>Por alunos ativos</small></div><div><span>Aulas ao vivo agendadas</span><strong>{data.totals.upcomingSessions}</strong><small>A partir de hoje</small></div></div>{attempts ? <div className="coord-exam-chart"><span>Aprovação nas tentativas</span><div className="coord-progress"><i style={{ width: `${Math.round(approved / attempts * 100)}%` }} /></div><p>{approved} aprovações · {attempts - approved} tentativas sem aprovação</p></div> : <p className="coord-muted">Ainda não há tentativas de prova no período selecionado.</p>}{!data.totals.students && <button className="coord-link" onClick={() => onNavigate('co-alunos')}>Cadastrar alunos <ArrowRight size={15} /></button>}</section></div>
      <section className="coord-panel"><PanelTitle eyebrow="DESEMPENHO POR MATÉRIA" title="Onde a turma avança" subtitle="Conclusão das aulas e melhor nota de cada aluno na prova final." action="Gerenciar matérias" onClick={() => onNavigate('co-gestao')} /><div className="coord-subject-filters"><input type="search" aria-label="Buscar matéria" placeholder="Buscar matéria ou curso" value={search} onChange={event => setSearch(event.target.value)} /><label>Ordenar <select value={sort} onChange={event => setSort(event.target.value as typeof sort)}><option value="progress">Mais aulas concluídas</option><option value="score">Maior média na prova</option><option value="name">Nome da matéria</option></select></label></div>{subjects.length ? <div className="coord-subject-list">{subjects.map(subject => <article className="coord-subject-row" key={subject.id}><div className="coord-subject-name"><strong>{subject.name}</strong><small>{subject.courseName} · {subject.lessons} aulas</small></div><div className="coord-subject-progress"><span>Conclusão das aulas <strong>{subject.completionPercent === null ? '—' : `${subject.completionPercent}%`}</strong></span><div className="coord-progress"><i style={{ width: `${subject.completionPercent ?? 0}%` }} /></div><small>{subject.possibleCompletions ? `${subject.completedLessons} de ${subject.possibleCompletions} conclusões possíveis` : 'Aguardando alunos e aulas'}</small></div><div className="coord-subject-score"><span>Média da prova</span><strong>{subject.averageScore === null ? '—' : subject.averageScore.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</strong><small>{subject.gradedStudents ? `${subject.gradedStudents} alunos avaliados` : 'Sem avaliação concluída'}</small></div><div className="coord-subject-top"><span>Alunos em destaque</span>{subject.standout.length ? <ol>{subject.standout.map(student => <li key={student.userId}>{student.name} <b>{student.score.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</b></li>)}</ol> : <small>Após a prova final</small>}</div></article>)}</div> : <Empty>{search ? 'Nenhuma matéria corresponde à busca.' : 'Cadastre matérias e aulas para acompanhar o desempenho.'}</Empty>}</section>
      <p className="coord-footnote">{data.financialNotice} O desempenho usa tentativas de provas feitas no período escolhido; o avanço das aulas considera todo o histórico.</p>
    </>}
  </main></>;
};
function Kpi({ icon, label, value, detail }: { icon: React.ReactElement; label: string; value: string; detail: string }) { return <article className="coord-kpi"><span className="coord-kpi-icon" aria-hidden="true">{icon}</span><span className="coord-kpi-label">{label}</span><strong>{value}</strong><small>{detail}</small></article>; }
function PanelTitle({ eyebrow, title, subtitle, action, onClick }: { eyebrow: string; title: string; subtitle: string; action?: string; onClick?: () => void }) { return <header className="coord-panel-head"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2><p>{subtitle}</p></div>{action && <button className="coord-link" onClick={onClick}>{action} <ArrowRight size={15} aria-hidden="true" /></button>}</header>; }
function Empty({ children }: { children: React.ReactNode }) { return <div className="coord-empty">{children}</div>; }
