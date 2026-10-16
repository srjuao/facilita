import React, { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { TopBar } from '../../components/TopBar';
import api from '../../api/client';
import { Student } from '../../types';

export const CoordStudents: React.FC = () => {
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<{ id: string; nome: string }[]>([]);
  const [courseId, setCourseId] = useState(user?.courseId || '');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [showCreate, setShowCreate] = useState(false);
  const [newStudent, setNewStudent] = useState({ nome: '', matricula: '', email: '', password: '' });
  const [notice, setNotice] = useState('');
  const load = async () => {
    setStudents([]);
    if (user?.role !== 'coord' && !user?.courseId) { setStatus('ready'); return; }
    setStatus('loading');
    try {
      setStudents((await api.get('/students', { params: { courseId: user?.role === 'coord' ? undefined : user?.courseId } })).data);
      setStatus('ready');
    } catch { setStatus('error'); }
  };
  useEffect(() => { void load(); }, [user?.id, user?.courseId]);
  useEffect(() => {
    if (user?.role !== 'coord') return;
    const controller = new AbortController();
    api.get('/institution/directory', { signal: controller.signal }).then(response => {
      setCourses(response.data.courses);
      setCourseId(current => current || response.data.courses[0]?.id || '');
    }).catch(() => { if (!controller.signal.aborted) setNotice('Não foi possível carregar os cursos da instituição.'); });
    return () => controller.abort();
  }, [user?.id, user?.role]);
  const createStudent = async (event: React.FormEvent) => {
    event.preventDefault(); if (saving) return; setSaving(true); setNotice('');
    try {
      const student = (await api.post('/students', { ...newStudent, courseId })).data as Student;
      setStudents(current => [...current, student]);
      setNewStudent({ nome: '', matricula: '', email: '', password: '' });
      setShowCreate(false); setStatus('ready');
      setNotice('Aluno cadastrado. A conta de acesso já está pronta.');
    } catch (error: any) { setNotice(error.response?.data?.error || 'Não foi possível cadastrar o aluno.'); }
    finally { setSaving(false); }
  };
  return (
    <div>
      <TopBar currentPage="Alunos" />
      <div className="unit-setup">
        <div className="page-head">
          <div><h1>Alunos{user?.role !== 'coord' && user?.course?.nome ? ' de ' + user.course.nome : ' da instituição'}</h1><p>Cadastros e matrículas. Métricas de estudo não são exibidas sem medição integrada.</p></div>
          <button className="btn primary" disabled={!courseId} onClick={() => setShowCreate(true)}>Cadastrar aluno</button>
        </div>
        {notice && <div className="card" role="status">{notice}</div>}
        {status === 'loading' ? <p role="status">Carregando alunos…</p> : status === 'error' ? <div className="inline-form-error" role="alert">Não foi possível carregar os alunos.<button className="btn" onClick={() => void load()}>Tentar novamente</button></div> :
          <div className="card">
            {students.length ? <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}><thead><tr><th style={{ padding: 12 }}>Aluno</th><th style={{ padding: 12 }}>Matrícula</th></tr></thead><tbody>{students.map(student => <tr key={student.id} style={{ borderTop: '1px solid var(--line)' }}><td style={{ padding: 12 }}>{student.nome}</td><td style={{ padding: 12 }}>{student.sub || 'Não informada'}</td></tr>)}</tbody></table></div> : <><h2>{user?.courseId ? 'Nenhum aluno cadastrado' : 'Nenhum curso associado'}</h2><p className="muted">{user?.courseId ? 'Cadastre o primeiro aluno para iniciar a turma.' : 'Configure um curso em Unidade e equipe para começar.'}</p></>}
          </div>}
        {showCreate && <div className="modal-backdrop"><form className="card college-form" onSubmit={createStudent}><button type="button" className="close" disabled={saving} onClick={() => setShowCreate(false)}>×</button><p className="eyebrow">NOVO ALUNO</p><h2>Criar acesso acadêmico</h2><p className="muted">A matrícula identifica o aluno dentro deste curso.</p>{user?.role === 'coord' && <label>Curso<select required disabled={saving} value={courseId} onChange={event => setCourseId(event.target.value)}><option value="">Selecione um curso</option>{courses.map(course => <option key={course.id} value={course.id}>{course.nome}</option>)}</select></label>}<label>Nome completo<input required value={newStudent.nome} onChange={event => setNewStudent({ ...newStudent, nome: event.target.value })} /></label><label>Matrícula<input required value={newStudent.matricula} onChange={event => setNewStudent({ ...newStudent, matricula: event.target.value })} /></label><label>E-mail<input required type="email" value={newStudent.email} onChange={event => setNewStudent({ ...newStudent, email: event.target.value })} /></label><label>Senha<input required type="password" minLength={8} value={newStudent.password} onChange={event => setNewStudent({ ...newStudent, password: event.target.value })} /><small>8+ caracteres, letra, número e caractere especial.</small></label><button className="primary" disabled={saving || !courseId}>{saving ? 'Cadastrando…' : 'Cadastrar aluno'}</button>{notice && <p role="status">{notice}</p>}</form></div>}
      </div>
    </div>
  );
};
