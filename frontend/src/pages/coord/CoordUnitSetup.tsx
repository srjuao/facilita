import React, { FormEvent, useEffect, useState } from 'react';
import { GraduationCap, Users } from 'lucide-react';
import { TopBar } from '../../components/TopBar';
import api from '../../api/client';

type Teacher = { id: string; nome: string; email: string };
type Course = { id: string; nome: string; status: string; users: Teacher[] };

export const CoordUnitSetup: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [teacher, setTeacher] = useState({ nome: '', email: '', password: '', courseId: '' });
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try { setCourses((await api.get('/coord/courses')).data); }
    catch { setNotice({ kind: 'error', text: 'Não foi possível carregar os cursos da unidade.' }); }
  };
  useEffect(() => { void load(); }, []);

  const createTeacher = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setNotice(null);
    try {
      const created = (await api.post('/coord/teachers', teacher)).data as Teacher;
      setCourses(current => current.map(course => course.id === teacher.courseId ? { ...course, users: [...course.users, created] } : course));
      setTeacher({ nome: '', email: '', password: '', courseId: teacher.courseId });
      setNotice({ kind: 'ok', text: `${created.nome} foi vinculado como professor.` });
    } catch (error: any) { setNotice({ kind: 'error', text: error.response?.data?.error || 'Não foi possível cadastrar o professor.' }); }
    finally { setSaving(false); }
  };

  return <div><TopBar currentPage="Equipe docente" /><main className="unit-setup">
    <div className="page-head"><div><p className="eyebrow">ADMINISTRAÇÃO DA UNIDADE</p><h1>Equipe docente</h1><p>Vincule professores aos cursos e organize suas permissões. Os cursos, períodos, matérias e aulas são cadastrados em Cursos e estrutura.</p></div></div>
    {notice && <div className={`notice ${notice.kind}`} role="alert">{notice.text}</div>}
    <div className="unit-setup-grid">
      <section className="card"><GraduationCap size={21} /><h2>Vincular professor</h2><p className="muted">O professor começa sem permissão de gestão. Após vinculá-lo, libere as funções em Departamentos e acessos.</p><form className="compact-form" onSubmit={createTeacher}><label>Nome<input required value={teacher.nome} onChange={event => setTeacher({ ...teacher, nome: event.target.value })} /></label><label>E-mail<input required type="email" value={teacher.email} onChange={event => setTeacher({ ...teacher, email: event.target.value })} /></label><label>Curso<select required value={teacher.courseId} onChange={event => setTeacher({ ...teacher, courseId: event.target.value })}><option value="">Selecione um curso</option>{courses.map(course => <option key={course.id} value={course.id}>{course.nome}</option>)}</select></label><label>Senha inicial<input required type="password" minLength={8} value={teacher.password} onChange={event => setTeacher({ ...teacher, password: event.target.value })} /><small>Ao menos 8 caracteres, com letra, número e caractere especial.</small></label><button className="primary" disabled={saving || !courses.length}><Users size={16} /> Vincular professor</button></form></section>
    </div>
    <section className="card unit-course-list"><h2>Professores por curso</h2>{courses.length ? courses.map(course => <article key={course.id}><div><b>{course.nome}</b><span className="pill warn">{course.status}</span></div><small>{course.users.length ? `Professores: ${course.users.map(user => user.nome).join(', ')}` : 'Nenhum professor vinculado ainda.'}</small></article>) : <p className="muted">Cadastre o primeiro curso em Cursos e estrutura para vincular professores.</p>}</section>
  </main></div>;
};
