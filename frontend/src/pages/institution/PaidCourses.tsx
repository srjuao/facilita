import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, LockKeyhole, ShieldCheck, Users } from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { TopBar } from '../../components/TopBar';
import './PaidCourses.css';

type Course = { id: string; nome: string; paidContent: boolean; contentPriceCents: number; saleVersion: number; hasAccess: boolean; requested: boolean; quotedPriceCents?: number | null };
type Student = { id: string; nome: string; email: string; hasAccess: boolean; included: boolean; manualAccess: boolean; requested: boolean; quotedPriceCents?: number | null; reason?: string | null };
const base = '/institution-commerce';
const money = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
function errorText(error: unknown, fallback: string) {
  const data = (error as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
  return data?.error || data?.message || fallback;
}

export function PaidCourses({ onOpenCourse }: { onOpenCourse?: (courseId: string) => void }) {
  const { user } = useAuth();
  const coord = user?.role === 'coord';
  const allowed = coord || user?.role === 'aluno';
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Course | null>(null);
  const [panel, setPanel] = useState<'offer' | 'access'>('offer');
  const editorHeading = useRef<HTMLHeadingElement>(null);
  const [busyId, setBusyId] = useState('');
  const lock = useRef(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  useEffect(() => {
    if (!selected) return;
    editorHeading.current?.focus({ preventScroll: true });
    editorHeading.current?.scrollIntoView({ block: 'center', behavior: 'auto' });
  }, [selected, panel]);
  useEffect(() => {
    if (!allowed) { setLoading(false); return; }
    const controller = new AbortController(); setLoading(true); setLoadError('');
    api.get<{ courses: Course[] }>(`${base}/catalog`, { signal: controller.signal })
      .then(response => { if (!controller.signal.aborted) setCourses(response.data.courses); })
      .catch(failure => { if (!controller.signal.aborted) setLoadError(errorText(failure, 'Não foi possível carregar os cursos.')); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [allowed, user?.id, retry]);
  async function requestAccess(course: Course) {
    if (lock.current) return;
    lock.current = true; setBusyId(course.id); setError(''); setSuccess('');
    try {
      await api.post(`${base}/courses/${encodeURIComponent(course.id)}/request`, {});
      const response = await api.get<{ courses: Course[] }>(`${base}/catalog`);
      setCourses(response.data.courses);
      setSuccess('Solicitação enviada à coordenação. Aguarde a liberação do curso.');
    } catch (failure) { setError(errorText(failure, 'Não foi possível solicitar a liberação.')); }
    finally { lock.current = false; setBusyId(''); }
  }
  function changed(updated: Course) {
    setCourses(current => current.map(course => course.id === updated.id ? updated : course));
    setSelected(updated); setSuccess('Oferta atualizada.');
  }
  const filtered = courses.filter(course => course.nome.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  return <><TopBar currentPage={coord ? 'Cursos e acessos' : 'Cursos disponíveis'} /><div className="paid-courses">
    <header className="pc-heading"><div><p className="eyebrow">CURSOS DA INSTITUIÇÃO</p><h1>{coord ? 'Conteúdo, preço e acesso.' : 'Continue aprendendo.'}</h1><p>{coord ? 'Defina quais cursos estão incluídos e quais têm uma oferta paga para seus alunos.' : 'Explore os cursos oferecidos pela sua instituição e acompanhe suas solicitações.'}</p></div><BookOpen size={30} aria-hidden="true" /></header>
    {!allowed ? <div className="pc-empty"><ShieldCheck size={28} /><h2>Acesso restrito</h2><p>A coordenação administra as ofertas. O catálogo está disponível somente aos alunos cadastrados na instituição.</p></div> : <>
      <aside className="pc-info"><ShieldCheck size={21} aria-hidden="true" /><p><strong>{coord ? 'Somente para alunos cadastrados.' : 'Liberação acompanhada pela coordenação.'}</strong> Ainda não há checkout ou cobrança automática. Solicitar acesso não confirma um pagamento; as liberações são manuais e registradas.</p></aside>
      {error && <p role="alert" className="pc-feedback pc-error">{error}</p>}{success && <p role="status" className="pc-feedback pc-success">{success}</p>}
      {loading ? <div className="pc-empty" role="status">Carregando cursos…</div> : loadError ? <div className="pc-empty"><p role="alert">{loadError}</p><button className="btn" onClick={() => setRetry(value => value + 1)}>Tentar novamente</button></div> : <>
        <div className="pc-toolbar"><h2>{courses.length} {courses.length === 1 ? 'curso cadastrado' : 'cursos cadastrados'}</h2><input type="search" aria-label="Buscar curso pelo nome" placeholder="Buscar curso" value={search} onChange={event => setSearch(event.target.value)} /></div>
        {filtered.length ? <div className="pc-list">{filtered.map(course => <article className="pc-course" key={course.id}><div className="pc-course-icon"><BookOpen size={22} aria-hidden="true" /></div><div className="pc-course-title"><h2>{course.nome}</h2><span className={`pc-badge ${course.paidContent ? 'pc-badge-paid' : ''}`}>{course.paidContent ? 'Conteúdo pago' : 'Incluído'}</span>{!coord && course.requested && !course.hasAccess && <p className="pc-meta">Aguardando a coordenação{course.quotedPriceCents != null ? ` · Valor solicitado: ${money(course.quotedPriceCents)}` : ''}</p>}</div><div className="pc-price"><strong>{course.paidContent ? money(course.contentPriceCents) : 'Incluído'}</strong><small>{course.paidContent ? 'Valor do curso' : 'Sem cobrança adicional'}</small></div><div className="pc-course-actions">{coord ? <><button className="btn" onClick={() => { setSelected(course); setPanel('offer'); setSuccess(''); }}>Configurar oferta</button><button className="btn" onClick={() => { setSelected(course); setPanel('access'); setSuccess(''); }}><Users size={16} />Acessos</button></> : course.hasAccess ? (onOpenCourse && <button className="btn primary" onClick={() => onOpenCourse(course.id)}>Abrir curso</button>) : course.paidContent ? <button className="btn primary" disabled={!!busyId || course.requested} onClick={() => void requestAccess(course)}><LockKeyhole size={16} />{busyId === course.id ? 'Enviando…' : course.requested ? 'Solicitação enviada' : 'Solicitar liberação'}</button> : <span className="pc-meta">Aguarde a vinculação pela coordenação.</span>}</div></article>)}</div> : <div className="pc-empty"><BookOpen size={30} aria-hidden="true" /><h2>{courses.length ? 'Nenhum resultado' : 'Nenhum curso disponível'}</h2><p>{courses.length ? 'Tente buscar por outro nome.' : coord ? 'Cadastre um curso em Gestão de cursos e aulas. Depois, configure a oferta aqui.' : 'Os cursos aparecerão aqui quando forem disponibilizados pela sua instituição.'}</p></div>}
      </>}
      {coord && selected && <section className="pc-editor" aria-labelledby="pc-editor-title"><header><div><p className="eyebrow">{panel === 'offer' ? 'CONFIGURAR OFERTA' : 'LIBERAÇÃO MANUAL'}</p><h2 id="pc-editor-title" ref={editorHeading} tabIndex={-1}>{selected.nome}</h2></div><button className="btn" onClick={() => setSelected(null)}>Fechar painel</button></header>{panel === 'offer' ? <Offer key={`${selected.id}:${selected.saleVersion}`} course={selected} onSaved={changed} /> : <Access key={selected.id} course={selected} />}</section>}
    </>}
  </div></>;
}

function Offer({ course, onSaved }: { course: Course; onSaved: (course: Course) => void }) {
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [paid, setPaid] = useState(course.paidContent);
  const [price, setPrice] = useState((course.contentPriceCents / 100).toFixed(2).replace('.', ','));
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false); const lock = useRef(false);
  const [error, setError] = useState('');
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (lock.current || (paid && !course.paidContent && !confirmed)) return;
    lock.current = true; setBusy(true); setError('');
    try {
      await api.patch(`${base}/courses/${encodeURIComponent(course.id)}/offer`, { paidContent: paid, price: paid ? price.trim() : '0', expectedVersion: course.saleVersion });
      const response = await api.get<{ courses: Course[] }>(`${base}/catalog`);
      const saved = response.data.courses.find(item => item.id === course.id);
      if (!saved) throw new Error('Curso não encontrado após atualização.');
      if (mounted.current) onSaved(saved);
    } catch (failure) { if (mounted.current) setError(errorText(failure, 'Não foi possível confirmar a atualização. Recarregue os cursos antes de tentar novamente.')); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }
  return <form className="pc-form" onSubmit={save}><fieldset disabled={busy}><legend>Disponibilidade do conteúdo</legend><label className="pc-radio"><input type="radio" name="offer-type" checked={!paid} onChange={() => setPaid(false)} /><span><strong>Incluído</strong><small>Sem cobrança adicional para alunos vinculados.</small></span></label><label className="pc-radio"><input type="radio" name="offer-type" checked={paid} onChange={() => setPaid(true)} /><span><strong>Conteúdo pago</strong><small>Acesso individual, liberado pela coordenação.</small></span></label>{paid && <label className="pc-price-input">Valor do curso (R$)<input required inputMode="decimal" placeholder="Ex.: 149,90" maxLength={14} value={price} onChange={event => setPrice(event.target.value)} /><small>O valor não gera uma cobrança automática.</small></label>}{paid && !course.paidContent && <label className="pc-confirm"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /><span>Entendo que tornar este curso pago pode bloquear alunos já vinculados que ainda não tenham uma liberação individual.</span></label>}</fieldset>{error && <p className="pc-feedback pc-error" role="alert">{error}</p>}<button className="btn primary" disabled={busy || (paid && !course.paidContent && !confirmed)}>{busy ? 'Salvando…' : 'Salvar oferta'}</button></form>;
}

function Access({ course }: { course: Course }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true); const [loadError, setLoadError] = useState(''); const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState(''); const [selectedId, setSelectedId] = useState('');
  const [reason, setReason] = useState(''); const [busy, setBusy] = useState(false); const lock = useRef(false);
  const [error, setError] = useState(''); const [success, setSuccess] = useState('');
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setLoadError('');
    async function load() {
      try {
        const all = new Map<string, Student>(); const seen = new Set<string>(); let cursor: string | null = null;
        do {
          const response: { data: { students: Student[]; nextCursor: string | null } } = await api.get(`${base}/courses/${encodeURIComponent(course.id)}/access`, { signal: controller.signal, params: cursor ? { cursor } : undefined });
          if (controller.signal.aborted) return;
          response.data.students.forEach(student => all.set(student.id, student)); cursor = response.data.nextCursor;
          if (cursor && seen.has(cursor)) throw new Error('Paginação não concluída.');
          if (cursor) seen.add(cursor);
        } while (cursor);
        if (!controller.signal.aborted) setStudents([...all.values()]);
      } catch (failure) { if (!controller.signal.aborted) setLoadError(errorText(failure, 'Não foi possível carregar os alunos.')); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load(); return () => controller.abort();
  }, [course.id, retry]);
  const selected = students.find(student => student.id === selectedId);
  async function changeAccess(event: React.FormEvent) {
    event.preventDefault(); if (!selected || selected.included || !reason.trim() || lock.current) return;
    lock.current = true; setBusy(true); setError(''); setSuccess('');
    try {
      await api.patch(`${base}/courses/${encodeURIComponent(course.id)}/access/${encodeURIComponent(selected.id)}`, { active: !selected.hasAccess, reason: reason.trim() });
      setSuccess(selected.hasAccess ? 'Liberação revogada. O motivo foi registrado.' : 'Acesso liberado manualmente. O motivo foi registrado; isso não confirma um pagamento.');
      setSelectedId(''); setReason(''); setRetry(value => value + 1);
    } catch (failure) { setError(errorText(failure, 'Não foi possível atualizar o acesso.')); }
    finally { lock.current = false; setBusy(false); }
  }
  const filtered = students.filter(student => `${student.nome} ${student.email}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  return <div className="pc-access"><p className="pc-meta">Somente alunos cadastrados nesta instituição. Toda alteração exige um motivo e fica registrada. Liberação manual não é confirmação de pagamento.</p>{!course.paidContent && <p className="pc-info">Este curso está incluído. Alunos vinculados não precisam de uma liberação de conteúdo pago.</p>}{success && <p className="pc-feedback pc-success" role="status">{success}</p>}{loading ? <p role="status">Carregando alunos…</p> : loadError ? <div><p role="alert" className="pc-feedback pc-error">{loadError}</p><button className="btn" onClick={() => setRetry(value => value + 1)}>Tentar novamente</button></div> : <><input type="search" aria-label="Buscar aluno por nome ou e-mail" placeholder="Buscar aluno por nome ou e-mail" value={search} onChange={event => setSearch(event.target.value)} /><div className="pc-students">{filtered.length ? filtered.map(student => <article key={student.id}><div><strong>{student.nome}</strong><small>{student.email}</small><span className="pc-meta">{student.included ? 'Acesso incluído pelo vínculo com o curso' : student.hasAccess ? 'Acesso disponível' : student.requested ? 'Solicitou liberação' : 'Sem liberação'}{student.quotedPriceCents != null ? ` · Valor solicitado: ${money(student.quotedPriceCents)}` : ''}</span></div>{!student.included && <button className="btn" disabled={busy} onClick={() => { setSelectedId(student.id); setReason(''); setError(''); setSuccess(''); }}>{student.hasAccess ? 'Revogar liberação' : 'Liberar acesso'}</button>}</article>) : <p className="pc-empty">{students.length ? 'Nenhum aluno encontrado nesta busca.' : 'Nenhum aluno cadastrado na instituição.'}</p>}</div></>}{selected && !selected.included && <form className="pc-access-form" onSubmit={changeAccess}><h3>{selected.hasAccess ? 'Revogar liberação' : 'Liberar acesso'} · {selected.nome}</h3><label>Motivo da alteração<textarea required rows={3} maxLength={500} disabled={busy} value={reason} onChange={event => setReason(event.target.value)} placeholder="Descreva por que este acesso será alterado." /></label><small>Não registre dados bancários ou informações sensíveis neste campo.</small>{error && <p className="pc-feedback pc-error" role="alert">{error}</p>}<div className="pc-actions"><button className="btn" type="button" disabled={busy} onClick={() => setSelectedId('')}>Cancelar</button><button className="btn primary" disabled={busy || !reason.trim()}>{busy ? 'Salvando…' : 'Confirmar alteração'}</button></div></form>}</div>;
}
