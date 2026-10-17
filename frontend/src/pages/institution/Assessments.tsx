import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, ClipboardList, FilePlus2, LockKeyhole } from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { TopBar } from '../../components/TopBar';
import { AppDialog } from '../../components/AppDialog';
import './Assessments.css';

type Course = { id: string; nome: string };
type Question = { id: string; enunciado: string; alternatives: string[]; correctIndex?: number; explanation?: string };
type Exam = { id: string; nome: string; published: boolean; archivedAt?: string | null; maxAttempts: number; passingScore: number; version: number; questionCount: number; attemptCount?: number; questions?: Question[] };
type Attempt = { id: string; score: number; correct: number; total: number; passed: boolean; number?: number; createdAt: string; user?: { nome: string; email?: string } };
type AttemptPage = { attempts: Attempt[]; nextCursor?: string | null };
type Feedback = { questionId: string; enunciado: string; alternatives: string[]; selectedIndex: number; correctIndex: number; explanation?: string };
const base = '/assessments';
const pathId = encodeURIComponent;
function message(error: unknown, fallback: string) {
  const data = (error as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
  return data?.error || data?.message || fallback;
}
function Empty({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="as-empty"><ClipboardList size={28} aria-hidden="true" /><h2>{title}</h2><div>{children}</div></div>;
}

export function Assessments({ courseId, initialExamId }: { courseId?: string; initialExamId?: string }) {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [selectedExam, setSelectedExam] = useState<string | null>(initialExamId || null);
  const [resultsRefresh, setResultsRefresh] = useState(0);
  const student = user?.role === 'aluno';
  const canManage = user?.role === 'coord' || (user?.role === 'professor' && permissions.includes('exams.manage'));
  const planBlocked = user?.tenant?.plan?.provas === false;
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(''); setSelectedExam(initialExamId || null);
    async function load() {
      if (planBlocked) { setLoading(false); return; }
      try {
        const access = await api.get<{ permissions: string[] }>('/institution/access', { signal: controller.signal });
        let options: Course[] = [];
        if (user?.role === 'coord') {
          const response = await api.get<{ courses: Course[] }>('/institution/directory', { signal: controller.signal });
          options = response.data.courses;
        } else {
          const id = courseId || user?.courseId;
          if (id) options = [{ id, nome: user?.course?.id === id ? user.course.nome : 'Curso selecionado' }];
        }
        if (controller.signal.aborted) return;
        setPermissions(access.data.permissions); setCourses(options);
        setSelectedCourse(options.some(course => course.id === courseId) ? courseId! : options[0]?.id || '');
      } catch (failure) { if (!controller.signal.aborted) setError(message(failure, 'Não foi possível carregar seus cursos.')); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load(); return () => controller.abort();
  }, [courseId, initialExamId, user?.id, user?.courseId, user?.course?.id, user?.course?.nome, user?.role, planBlocked, retry]);
  return <><TopBar currentPage="Provas e atividades" /><div className="assessments">
    <header className="as-heading"><div><p className="eyebrow">APRENDIZAGEM E AVALIAÇÃO</p><h1>{student ? 'Mostre o que aprendeu.' : 'Provas e atividades.'}</h1><p>{student ? 'Responda às avaliações publicadas e acompanhe suas notas.' : 'Prepare questões, publique avaliações e acompanhe os resultados reais dos alunos.'}</p></div><ClipboardList size={30} aria-hidden="true" /></header>
    {planBlocked ? <Empty title="Avaliações não incluídas"><p>O plano da instituição não permite provas. Fale com a coordenação.</p></Empty> : loading ? <p role="status">Carregando acesso e cursos…</p> : error ? <Empty title="Não foi possível abrir as avaliações"><p role="alert">{error}</p><button className="btn" onClick={() => setRetry(value => value + 1)}>Tentar novamente</button></Empty> : !courses.length ? <Empty title="Nenhum curso disponível"><p>{student ? 'Sua conta precisa estar vinculada a um curso para acessar as avaliações.' : 'Cadastre um curso e vincule a equipe antes de preparar as avaliações.'}</p></Empty> : <>
      <label className="as-course">Curso<select value={selectedCourse} onChange={event => { setSelectedCourse(event.target.value); setSelectedExam(null); }}>{courses.map(course => <option key={course.id} value={course.id}>{course.nome}</option>)}</select></label>
      {selectedExam ? <ExamDetail key={`${selectedCourse}:${selectedExam}`} examId={selectedExam} canManage={canManage} student={student} onBack={() => setSelectedExam(null)} onAttemptSaved={() => setResultsRefresh(value => value + 1)} /> : <ExamList key={selectedCourse} courseId={selectedCourse} canManage={canManage} onOpen={setSelectedExam} />}
    </>}
    {student && <StudentResults refreshKey={resultsRefresh} />}
  </div></>;
}

type PersonalResult = Attempt & { exam: { id: string; nome: string; archivedAt: string | null; course: Course } };
function StudentResults({ refreshKey }: { refreshKey: number }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<PersonalResult[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(''); setRows([]);
    api.get<{ attempts: PersonalResult[]; nextCursor: string | null }>(`${base}/my-results`, { signal: controller.signal })
      .then(response => { if (!controller.signal.aborted) { setRows(response.data.attempts); setCursor(response.data.nextCursor); } })
      .catch(failure => { if (!controller.signal.aborted) setError(message(failure, 'Não foi possível carregar seu histórico geral.')); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [user?.id, retry, refreshKey]);
  const more = async () => {
    if (!cursor || busy.current) return; busy.current = true; setLoading(true); setError('');
    try {
      const response = await api.get<{ attempts: PersonalResult[]; nextCursor: string | null }>(`${base}/my-results`, { params: { cursor } });
      if (mounted.current) { setRows(current => [...new Map([...current, ...response.data.attempts].map(row => [row.id, row])).values()]); setCursor(response.data.nextCursor); }
    } catch (failure) { if (mounted.current) setError(message(failure, 'Não foi possível carregar mais resultados.')); }
    finally { busy.current = false; if (mounted.current) setLoading(false); }
  };
  return <section className="as-panel as-history" style={{ marginTop: 28 }}><h2>Meu histórico geral de resultados</h2><p>Suas notas continuam disponíveis mesmo quando uma avaliação é arquivada.</p>{error && <div role="alert" className="as-error">{error}<button className="btn" disabled={loading} onClick={() => setRetry(value => value + 1)}>Atualizar histórico</button></div>}{loading && <p role="status">Carregando resultados…</p>}{rows.length ? <div className="as-table-wrap"><table><thead><tr><th>Avaliação</th><th>Curso</th><th>Nota</th><th>Resultado</th><th>Data</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td>{row.exam.nome}{row.exam.archivedAt && <small> · Arquivada</small>}</td><td>{row.exam.course.nome}</td><td>{row.score.toLocaleString('pt-BR')} / 10</td><td>{row.passed ? 'Nota atingida' : 'Abaixo da nota mínima'}</td><td>{new Date(row.createdAt).toLocaleString('pt-BR')}</td></tr>)}</tbody></table></div> : !loading && !error && <p className="muted">Você ainda não tem resultados registrados.</p>}{cursor && <button className="btn" disabled={loading} onClick={() => void more()}>Carregar mais resultados</button>}</section>;
}

function ExamList({ courseId, canManage, onOpen }: { courseId: string; canManage: boolean; onOpen: (id: string) => void }) {
  const [exams, setExams] = useState<Exam[]>([]); const [loading, setLoading] = useState(true);
  const [error, setError] = useState(''); const [retry, setRetry] = useState(0);
  const [creating, setCreating] = useState(false); const [name, setName] = useState('');
  const [busy, setBusy] = useState(false); const lock = useRef(false); const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    api.get<{ exams: Exam[] }>(`${base}/courses/${pathId(courseId)}/exams`, { signal: controller.signal })
      .then(response => { if (!controller.signal.aborted) setExams(response.data.exams); })
      .catch(failure => { if (!controller.signal.aborted) setError(message(failure, 'Não foi possível carregar as avaliações.')); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [courseId, retry]);
  async function create(event: React.FormEvent) {
    event.preventDefault(); if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const response = await api.post<{ exam: Exam }>(`${base}/courses/${pathId(courseId)}/exams`, { nome: name.trim(), maxAttempts: 1, passingScore: 7 });
      if (mounted.current) onOpen(response.data.exam.id);
    } catch (failure) { if (mounted.current) setError(message(failure, 'Não foi possível criar o rascunho. Atualize a lista antes de tentar novamente.')); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }
  return <section className="as-list"><div className="as-toolbar"><div><h2>Avaliações do curso</h2><p>Somente avaliações publicadas ficam disponíveis aos alunos.</p></div>{canManage && <button className="btn primary" onClick={() => setCreating(value => !value)} aria-expanded={creating}><FilePlus2 size={17} />{creating ? 'Fechar criação' : 'Nova avaliação'}</button>}</div>
    {creating && <AppDialog title="Nova avaliação" eyebrow="ETAPA 1 · RASCUNHO" description="Comece pelo nome. Depois, prepare as questões e revise os critérios antes de publicar." busy={busy} onClose={() => setCreating(false)}><div className="assessments as-dialog-content"><form className="as-create" onSubmit={create}><label>Nome da avaliação<input required maxLength={160} placeholder="Ex.: Avaliação do primeiro período" value={name} onChange={event => setName(event.target.value)} disabled={busy} /></label><button className="btn primary" disabled={busy || !name.trim()}>{busy ? 'Criando…' : 'Continuar para questões'}</button><p>O rascunho começa com uma tentativa e nota mínima 7. Você poderá ajustar esses critérios.</p>{error && <p className="as-error" role="alert">{error}</p>}</form></div></AppDialog>}
    {error && <div className="as-error" role="alert"><p>{error}</p><button className="btn" onClick={() => setRetry(value => value + 1)} disabled={busy}>Atualizar lista</button></div>}
    {loading ? <p role="status">Carregando avaliações…</p> : !exams.length ? <Empty title="Nenhuma avaliação disponível"><p>{canManage ? 'Crie o primeiro rascunho e adicione suas questões.' : 'As avaliações aparecerão aqui quando forem publicadas pela equipe.'}</p></Empty> : <div className="as-exams">{exams.map(exam => <article key={exam.id}><div className="as-exam-icon"><ClipboardList size={22} aria-hidden="true" /></div><div><span className="as-status">{exam.archivedAt ? 'Arquivada' : exam.published ? 'Publicada' : 'Rascunho'}</span><h3>{exam.nome}</h3><p>{exam.questionCount} questões · Nota mínima {exam.passingScore.toLocaleString('pt-BR')} · Até {exam.maxAttempts} {exam.maxAttempts === 1 ? 'tentativa' : 'tentativas'}</p></div><button className="btn" onClick={() => onOpen(exam.id)}>{canManage ? 'Gerenciar' : 'Abrir avaliação'}</button></article>)}</div>}
  </section>;
}

function ExamDetail({ examId, canManage, student, onBack, onAttemptSaved }: { examId: string; canManage: boolean; student: boolean; onBack: () => void; onAttemptSaved: () => void }) {
  const [exam, setExam] = useState<Exam | null>(null); const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [success, setSuccess] = useState('');
  const [retry, setRetry] = useState(0); const [busy, setBusy] = useState(false); const lock = useRef(false); const mounted = useRef(true);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<Attempt | null>(null); const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [uncertain, setUncertain] = useState(false); const submission = useRef('');
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { mounted.current = true; heading.current?.focus(); return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    Promise.all([
      api.get<{ exam: Exam }>(`${base}/exams/${pathId(examId)}`, { signal: controller.signal }),
      api.get<AttemptPage>(`${base}/exams/${pathId(examId)}/attempts`, { signal: controller.signal }),
    ]).then(([detail, history]) => { if (!controller.signal.aborted) { setExam(detail.data.exam); setAttempts(history.data.attempts); setNextCursor(history.data.nextCursor || null); } })
      .catch(failure => { if (!controller.signal.aborted) setError(message(failure, 'Não foi possível carregar a avaliação e o histórico.')); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [examId, retry]);
  async function mutate(action: () => Promise<unknown>, text: string) {
    if (lock.current) return; lock.current = true; setBusy(true); setError(''); setSuccess('');
    try {
      await action();
      const response = await api.get<{ exam: Exam }>(`${base}/exams/${pathId(examId)}`);
      if (mounted.current) { setExam(response.data.exam); setSuccess(text); }
    } catch (failure) { if (mounted.current) setError(message(failure, 'Não foi possível confirmar a alteração. Atualize a avaliação antes de tentar novamente.')); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (!exam || lock.current || uncertain) return;
    lock.current = true; setBusy(true); setError('');
    if (!submission.current) submission.current = crypto.randomUUID();
    try {
      const response = await api.post<{ attempt: Attempt; feedback?: Feedback[] }>(`${base}/exams/${pathId(exam.id)}/attempts`, { examVersion: exam.version, submissionId: submission.current, answers: (exam.questions || []).map(question => ({ questionId: question.id, alternativeIndex: answers[question.id] })) });
      if (!mounted.current) return;
      setResult(response.data.attempt); setFeedback(response.data.feedback || []);
      onAttemptSaved();
      setAttempts(current => [response.data.attempt, ...current.filter(attempt => attempt.id !== response.data.attempt.id)]);
      setSuccess('Respostas corrigidas e resultado salvo.'); setUncertain(false);
    } catch (failure) { if (mounted.current) { setError(message(failure, 'Não foi possível confirmar o envio. Consulte o histórico antes de tentar novamente.')); setUncertain(true); } }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }
  async function checkSubmission() {
    if (lock.current) return; lock.current = true; setBusy(true); setError('');
    try {
      const response = await api.get<AttemptPage>(`${base}/exams/${pathId(examId)}/attempts`);
      if (!mounted.current) return;
      setAttempts(response.data.attempts); setNextCursor(response.data.nextCursor || null); setUncertain(false);
      onAttemptSaved();
      setSuccess('Histórico atualizado. Se o resultado não apareceu, você pode reenviar as mesmas respostas com segurança.');
    } catch (failure) { if (mounted.current) setError(message(failure, 'Não foi possível consultar o histórico. Aguarde antes de reenviar.')); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }
  async function loadMore() {
    if (lock.current || !nextCursor) return; lock.current = true; setBusy(true); setError('');
    try {
      const response = await api.get<AttemptPage>(`${base}/exams/${pathId(examId)}/attempts`, { params: { cursor: nextCursor } });
      if (!mounted.current) return;
      setAttempts(current => [...new Map([...current, ...response.data.attempts].map(attempt => [attempt.id, attempt])).values()]);
      setNextCursor(response.data.nextCursor || null);
    } catch (failure) { if (mounted.current) setError(message(failure, 'Não foi possível carregar mais resultados.')); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }
  const questions = exam?.questions || [];
  const completed = questions.length > 0 && questions.every(question => Number.isInteger(answers[question.id]));
  return <section className="as-detail"><button className="btn" disabled={busy} onClick={onBack}><ArrowLeft size={16} />Voltar às avaliações</button><h2 ref={heading} tabIndex={-1}>{exam?.nome || 'Avaliação'}</h2>
    {error && <div className="as-error"><p role="alert">{error}</p>{!uncertain && <button className="btn" disabled={busy} onClick={() => setRetry(value => value + 1)}>Atualizar avaliação e histórico</button>}</div>}{success && <p className="as-success" role="status">{success}</p>}
    {loading ? <p role="status">Carregando avaliação e histórico…</p> : !exam ? <button className="btn" onClick={() => setRetry(value => value + 1)}>Tentar novamente</button> : <>
      <div className="as-summary"><span>{exam.archivedAt ? 'Arquivada' : exam.published ? 'Publicada' : 'Rascunho'}</span><span>{questions.length} questões</span><span>Nota mínima {exam.passingScore.toLocaleString('pt-BR')}</span><span>Até {exam.maxAttempts} tentativas</span></div>
      {canManage ? <><ExamSettings key={`${exam.id}:${exam.version}`} exam={exam} busy={busy} error={error} mutate={mutate} />{!exam.published && !exam.archivedAt ? <QuestionEditor key={`${exam.id}:${exam.version}`} exam={exam} busy={busy} error={error} mutate={mutate} /> : <div className="as-info"><LockKeyhole size={20} aria-hidden="true" /><p>Questões publicadas não podem ser alteradas. Crie outra avaliação se precisar mudar o conteúdo ou o gabarito.</p></div>}
        <div className="as-questions">{questions.map((question, index) => <article className="as-panel" key={question.id}><h3>{index + 1}. {question.enunciado}</h3><ol type="A">{question.alternatives.map((alternative, option) => <li key={option}>{alternative}{question.correctIndex === option && <strong> — Resposta correta</strong>}</li>)}</ol>{question.explanation && <p>{question.explanation}</p>}</article>)}</div>
      </> : student ? result ? <section className="as-result" aria-live="polite"><CheckCircle2 size={28} aria-hidden="true" /><h3>Resultado registrado</h3><strong>{result.score.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} / 10</strong><p>{result.correct} de {result.total} questões corretas · {result.passed ? 'Nota mínima atingida' : 'Nota mínima não atingida'}</p>{feedback.map(item => <details key={item.questionId}><summary>{item.enunciado}</summary><p>Sua resposta: {item.alternatives[item.selectedIndex] || 'Não respondida'}</p><p>Resposta correta: {item.alternatives[item.correctIndex]}</p>{item.explanation && <p>{item.explanation}</p>}</details>)}<button className="btn" disabled={busy || attempts.length >= exam.maxAttempts} onClick={() => { setResult(null); setFeedback([]); setAnswers({}); submission.current = ''; setSuccess(''); }}>Iniciar outra tentativa</button></section> : !exam.published || exam.archivedAt ? <Empty title="Avaliação indisponível"><p>Esta avaliação não está recebendo respostas.</p></Empty> : attempts.length >= exam.maxAttempts && !uncertain ? <Empty title="Tentativas concluídas"><p>Você atingiu o limite de tentativas. Consulte seus resultados abaixo.</p></Empty> : <form className="as-response" onSubmit={submit}><div className="as-info"><p>Suas respostas serão corrigidas no envio. Confira todas as questões antes de concluir.</p></div><fieldset disabled={busy || uncertain}><legend className="as-sr-only">Respostas da avaliação</legend>{questions.map((question, index) => <fieldset className="as-question" key={question.id}><legend>{index + 1}. {question.enunciado}</legend>{question.alternatives.map((alternative, option) => <label key={option}><input required type="radio" name={`question-${question.id}`} checked={answers[question.id] === option} onChange={() => setAnswers(current => ({ ...current, [question.id]: option }))} /><span>{String.fromCharCode(65 + option)}. {alternative}</span></label>)}</fieldset>)}</fieldset>{uncertain ? <div className="as-info"><p>O envio pode ter sido recebido. Atualize o histórico antes de reenviar; não feche esta tela para preservar a identificação do envio.</p><button type="button" className="btn" disabled={busy} onClick={() => void checkSubmission()}>{busy ? 'Consultando…' : 'Conferir histórico do envio'}</button></div> : <button className="btn primary" disabled={busy || !completed}>{busy ? 'Corrigindo e salvando…' : 'Enviar respostas'}</button>}</form> : <Empty title="Sem permissão para gerenciar"><p>A coordenação precisa conceder a permissão de gestão de avaliações à sua conta.</p></Empty>}
      <section className="as-history"><h3>{student ? 'Minhas tentativas' : 'Resultados dos alunos'}</h3>{!attempts.length ? <p>Nenhuma tentativa registrada.</p> : <div className="as-table-wrap"><table><thead><tr>{!student && <th>Aluno</th>}<th>Data</th><th>Nota</th><th>Acertos</th><th>Resultado</th></tr></thead><tbody>{attempts.map(attempt => <tr key={attempt.id}>{!student && <td>{attempt.user?.nome || 'Aluno'}</td>}<td>{new Date(attempt.createdAt).toLocaleString('pt-BR')}</td><td>{attempt.score.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td><td>{attempt.correct} / {attempt.total}</td><td>{attempt.passed ? 'Nota atingida' : 'Abaixo da nota mínima'}</td></tr>)}</tbody></table></div>}{nextCursor && <button className="btn" disabled={busy} onClick={() => void loadMore()}>{busy ? 'Carregando…' : 'Carregar mais resultados'}</button>}</section>
    </>}
  </section>;
}

type Mutate = (action: () => Promise<unknown>, text: string) => Promise<void>;
function ExamSettings({ exam, busy, error, mutate }: { exam: Exam; busy: boolean; error: string; mutate: Mutate }) {
  const [name, setName] = useState(exam.nome); const [limit, setLimit] = useState(exam.maxAttempts); const [passing, setPassing] = useState(exam.passingScore);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  function save(event: React.FormEvent) { event.preventDefault(); void mutate(() => api.patch(`${base}/exams/${pathId(exam.id)}`, { nome: name.trim(), maxAttempts: limit, passingScore: passing, expectedVersion: exam.version }), 'Critérios atualizados.'); }
  return <section className="as-panel"><div className="as-toolbar"><div><h3>Critérios e publicação</h3><p>{exam.maxAttempts} tentativas · Nota mínima {exam.passingScore.toLocaleString('pt-BR')}</p></div>{!exam.published && !exam.archivedAt && <button className="btn" disabled={busy} onClick={() => setSettingsOpen(true)}>Editar critérios</button>}</div><div className="as-actions">{!exam.published && !exam.archivedAt && <button className="btn primary" disabled={busy || !exam.questions?.length || name.trim() !== exam.nome || limit !== exam.maxAttempts || passing !== exam.passingScore} onClick={() => void mutate(() => api.patch(`${base}/exams/${pathId(exam.id)}`, { published: true, expectedVersion: exam.version }), 'Avaliação publicada para os alunos.')}>Publicar avaliação</button>}<button className="btn" disabled={busy} onClick={() => setConfirmArchive(true)}>{exam.archivedAt ? 'Restaurar avaliação' : 'Arquivar avaliação'}</button></div>
    {settingsOpen && <AppDialog title="Critérios da avaliação" eyebrow="ETAPA 3 · REVISÃO" busy={busy} onClose={() => { setName(exam.nome); setLimit(exam.maxAttempts); setPassing(exam.passingScore); setSettingsOpen(false); }}><div className="assessments as-dialog-content"><form className="as-settings" onSubmit={save}><fieldset disabled={busy}><label>Nome<input required maxLength={160} value={name} onChange={event => setName(event.target.value)} /></label><label>Limite de tentativas<input type="number" required min={1} max={20} step={1} value={limit} onChange={event => setLimit(Number(event.target.value))} /></label><label>Nota mínima (0 a 10)<input type="number" required min={0} max={10} step="0.1" value={passing} onChange={event => setPassing(Number(event.target.value))} /></label></fieldset>{error && <p className="as-error" role="alert">{error}</p>}<button className="btn primary" disabled={busy}>{busy ? 'Salvando…' : 'Salvar critérios'}</button></form></div></AppDialog>}
    {confirmArchive && <AppDialog title={exam.archivedAt ? 'Restaurar avaliação?' : 'Arquivar avaliação?'} busy={busy} onClose={() => setConfirmArchive(false)}><div className="assessments as-dialog-content"><p>{exam.archivedAt ? 'A avaliação voltará ao estado anterior ao arquivamento.' : 'Novos envios serão interrompidos. Os resultados dos alunos serão preservados.'}</p>{error && <p className="as-error" role="alert">{error}</p>}<div className="as-actions"><button className="btn" disabled={busy} onClick={() => setConfirmArchive(false)}>Cancelar</button><button className="btn primary" disabled={busy} onClick={() => void mutate(() => api.patch(`${base}/exams/${pathId(exam.id)}`, { archived: !exam.archivedAt, expectedVersion: exam.version }), exam.archivedAt ? 'Avaliação restaurada.' : 'Avaliação arquivada. Histórico preservado.')}>{busy ? 'Salvando…' : exam.archivedAt ? 'Restaurar avaliação' : 'Arquivar avaliação'}</button></div></div></AppDialog>}
  </section>;
}

function QuestionEditor({ exam, busy, error, mutate }: { exam: Exam; busy: boolean; error: string; mutate: Mutate }) {
  const [editing, setEditing] = useState(''); const [prompt, setPrompt] = useState(''); const [options, setOptions] = useState(['', '', '', '']);
  const [correct, setCorrect] = useState(0); const [explanation, setExplanation] = useState('');
  const [removeId, setRemoveId] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  function edit(question?: Question) { setEditing(question?.id || ''); setPrompt(question?.enunciado || ''); setOptions(question?.alternatives || ['', '', '', '']); setCorrect(question?.correctIndex ?? 0); setExplanation(question?.explanation || ''); setEditorOpen(true); }
  function save(event: React.FormEvent) {
    event.preventDefault();
    const payload = { enunciado: prompt.trim(), alternatives: options.map(option => option.trim()), correctIndex: correct, explanation: explanation.trim(), expectedVersion: exam.version };
    void mutate(() => editing ? api.patch(`${base}/exams/${pathId(exam.id)}/questions/${pathId(editing)}`, payload) : api.post(`${base}/exams/${pathId(exam.id)}/questions`, payload), editing ? 'Questão atualizada.' : 'Questão adicionada.');
  }
  return <section className="as-panel"><div className="as-toolbar"><div><h3>Questões da avaliação</h3><p>Enunciados, alternativas e gabarito em um só lugar.</p></div><button className="btn primary" disabled={busy} onClick={() => edit()}><FilePlus2 size={17} />Adicionar questão</button></div>{exam.questions?.length ? <ul className="as-question-list">{exam.questions.map((question, index) => <li key={question.id}><span>{index + 1}. {question.enunciado}</span><button className="btn" disabled={busy} onClick={() => edit(question)}>Editar questão {index + 1}</button><button className="btn" disabled={busy} onClick={() => setRemoveId(question.id)}>Remover questão {index + 1}</button></li>)}</ul> : <p className="as-info">Nenhuma questão adicionada. Prepare a primeira para começar esta avaliação.</p>}
    {editorOpen && <AppDialog title={editing ? 'Editar questão' : 'Adicionar questão'} eyebrow="ETAPA 2 · CONTEÚDO" description="Escreva o enunciado e marque a alternativa correta." busy={busy} wide onClose={() => setEditorOpen(false)}><div className="assessments as-dialog-content"><form className="as-question-form" onSubmit={save}><fieldset disabled={busy}><legend>{editing ? 'Editar questão' : 'Nova questão'}</legend><label>Enunciado<textarea required rows={3} maxLength={4000} value={prompt} onChange={event => setPrompt(event.target.value)} /></label><fieldset className="as-alternatives"><legend>Alternativas · selecione a resposta correta</legend>{options.map((option, index) => <div key={index}><label className="as-correct"><input type="radio" name="correct-answer" checked={correct === index} onChange={() => setCorrect(index)} /><span>{String.fromCharCode(65 + index)}<span className="as-sr-only"> é a resposta correta</span></span></label><input aria-label={`Texto da alternativa ${String.fromCharCode(65 + index)}`} required maxLength={2000} value={option} onChange={event => setOptions(current => current.map((value, position) => position === index ? event.target.value : value))} /></div>)}</fieldset><label>Explicação da resposta (opcional)<textarea rows={2} maxLength={4000} value={explanation} onChange={event => setExplanation(event.target.value)} /></label></fieldset>{error && <p className="as-error" role="alert">{error}</p>}<div className="as-actions"><button className="btn" type="button" disabled={busy} onClick={() => setEditorOpen(false)}>Cancelar</button><button className="btn primary" disabled={busy}>{busy ? 'Salvando…' : editing ? 'Salvar questão' : 'Adicionar questão'}</button></div></form></div></AppDialog>}
    {removeId && <AppDialog title="Remover questão?" description="A questão será retirada deste rascunho." busy={busy} onClose={() => setRemoveId('')}><div className="assessments as-dialog-content">{error && <p className="as-error" role="alert">{error}</p>}<div className="as-actions"><button className="btn" disabled={busy} onClick={() => setRemoveId('')}>Cancelar</button><button className="btn primary" disabled={busy} onClick={() => void mutate(() => api.patch(`${base}/exams/${pathId(exam.id)}/questions/${pathId(removeId)}`, { removed: true, expectedVersion: exam.version }), 'Questão removida do rascunho.')}>{busy ? 'Removendo…' : 'Remover questão'}</button></div></div></AppDialog>}
  </section>;
}
