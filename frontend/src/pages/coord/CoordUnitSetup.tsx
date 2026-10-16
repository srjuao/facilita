import React, { FormEvent, useEffect, useRef, useState } from 'react';
import { GraduationCap, Plus, Users } from 'lucide-react';
import { TopBar } from '../../components/TopBar';
import { AppDialog } from '../../components/AppDialog';
import api from '../../api/client';
import '../institution/InstitutionWorkspace.css';

type Teacher = { id: string; nome: string; email: string };
type Course = { id: string; nome: string; status: string; users: Teacher[] };

export const CoordUnitSetup: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [teacher, setTeacher] = useState({ nome: '', email: '', password: '', courseId: '' });
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const lock = useRef(false);

  const load = async () => {
    try { setCourses((await api.get('/coord/courses')).data); }
    catch { setNotice({ kind: 'error', text: 'Não foi possível carregar os cursos da unidade.' }); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const createTeacher = async (event: FormEvent) => {
    event.preventDefault(); if (lock.current) return; lock.current = true; setSaving(true); setNotice(null);
    try {
      const created = (await api.post('/coord/teachers', teacher)).data as Teacher;
      setCourses(current => current.map(course => course.id === teacher.courseId ? { ...course, users: [...course.users, created] } : course));
      setTeacher({ nome: '', email: '', password: '', courseId: teacher.courseId });
      setNotice({ kind: 'ok', text: `${created.nome} foi vinculado como professor.` });
      setOpen(false);
    } catch (error: any) { setNotice({ kind: 'error', text: error.response?.data?.error || 'Não foi possível cadastrar o professor.' }); }
    finally { lock.current = false; setSaving(false); }
  };

  return <div><TopBar currentPage="Equipe docente" /><main className="unit-setup">
    <div className="page-head"><div><p className="eyebrow">ADMINISTRAÇÃO DA UNIDADE</p><h1>Equipe docente</h1><p>Professores organizados por curso. Configure suas funções em Departamentos e acessos.</p></div><button className="primary" disabled={loading || !courses.length} onClick={() => { setTeacher({ nome: '', email: '', password: '', courseId: '' }); setNotice(null); setStep(0); setOpen(true); }}><Plus size={18} />Vincular professor</button></div>
    {notice && <div className={`notice ${notice.kind}`} role="alert">{notice.text}</div>}
    <section className="card unit-course-list iw-teacher-list"><div className="iw-toolbar"><h2><GraduationCap size={21} />Professores por curso</h2><span className="iw-count">{courses.reduce((sum, course) => sum + course.users.length, 0)} vínculos</span></div>{loading ? <p role="status">Carregando equipe docente…</p> : courses.length ? courses.map(course => <article key={course.id}><div><b>{course.nome}</b><span className="pill warn">{course.status}</span></div><small>{course.users.length ? course.users.map(user => user.nome).join(', ') : 'Nenhum professor vinculado ainda.'}</small><button className="ghost" onClick={() => { setTeacher({ nome: '', email: '', password: '', courseId: course.id }); setNotice(null); setStep(0); setOpen(true); }}><Plus size={15} />Vincular professor<span className="iw-sr-only"> a {course.nome}</span></button></article>) : <div className="iw-empty"><h2>Comece pela estrutura do curso</h2><p>Cadastre o primeiro curso em Cursos e estrutura para vincular professores.</p>{notice?.kind === 'error' && <button className="ghost" onClick={() => { setLoading(true); void load(); }}>Tentar novamente</button>}</div>}</section>
    {open && <AppDialog title="Vincular professor" eyebrow="EQUIPE DOCENTE" description="Crie o acesso do professor e escolha o curso em que ele vai atuar." busy={saving} focusKey={step} onClose={() => setOpen(false)}>
      <ol className="iw-flow-steps" aria-label="Etapas do cadastro"><li aria-current={step === 0 ? 'step' : undefined}><span>1</span>Dados de acesso</li><li aria-current={step === 1 ? 'step' : undefined}><span>2</span>Curso e vínculo</li></ol>
      {notice?.kind === 'error' && <p className="iw-feedback iw-error" role="alert">{notice.text}</p>}
      <form className="iw-form" onSubmit={event => { if (step === 0) { event.preventDefault(); setStep(1); } else void createTeacher(event); }}><fieldset disabled={saving} className="iw-reset-fieldset iw-form">
        {step === 0 ? <><label>Nome completo<input required maxLength={120} autoComplete="name" value={teacher.nome} onChange={event => setTeacher({ ...teacher, nome: event.target.value })} /></label><label>E-mail<input required type="email" maxLength={254} autoComplete="email" value={teacher.email} onChange={event => setTeacher({ ...teacher, email: event.target.value })} /></label><label>Senha de acesso<input required type="password" minLength={8} autoComplete="new-password" value={teacher.password} onChange={event => setTeacher({ ...teacher, password: event.target.value })} /><small>Ao menos 8 caracteres, com letra, número e caractere especial.</small></label></> : <><div className="iw-person-summary"><Users size={20} /><div><strong>{teacher.nome}</strong><small>{teacher.email}</small></div></div><label>Curso<select required value={teacher.courseId} onChange={event => setTeacher({ ...teacher, courseId: event.target.value })}><option value="">Selecione um curso</option>{courses.map(course => <option key={course.id} value={course.id}>{course.nome}</option>)}</select></label><p className="iw-feedback">O professor começa sem permissões de gestão. Libere as funções em Departamentos e acessos após o cadastro.</p></>}
        <div className="iw-actions"><button className="ghost" type="button" onClick={() => step ? setStep(0) : setOpen(false)}>{step ? 'Voltar' : 'Cancelar'}</button><button className="primary" disabled={saving || (step === 1 && !teacher.courseId)}>{saving ? 'Salvando…' : step === 0 ? 'Continuar' : 'Vincular professor'}</button></div>
      </fieldset></form>
    </AppDialog>}
  </main></div>;
};
