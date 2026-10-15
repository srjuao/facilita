import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import api from '../api/client';
import { TopBar } from './TopBar';

// These screens use persisted course records, never demonstration fixtures.
export const CourseRecords: React.FC<{ title: string; kind: 'modules' | 'exams' | 'alerts' | 'live' | 'empty' }> = ({ title, kind }) => {
  const { user } = useAuth();
  const [course, setCourse] = useState<any>(null);
  const [status, setStatus] = useState('loading');
  const load = async () => {
    setStatus('loading'); setCourse(null);
    if (!user?.courseId) { setStatus('ready'); return; }
    try { setCourse((await api.get('/courses/' + user.courseId)).data); setStatus('ready'); }
    catch { setStatus('error'); }
  };
  useEffect(() => { void load(); }, [user?.id, user?.courseId]);
  const modules = course?.modules || [];
  const exams = course?.exams || [];
  const students = course?.students || [];
  const items = kind === 'modules' ? modules : kind === 'exams' ? exams : kind === 'alerts' ? students.filter((student: any) => student.risco === 'alto') : kind === 'live' ? students.filter((student: any) => student.online) : [];
  return <div><TopBar currentPage={title} /><section className="unit-setup"><div className="page-head"><div><p className="eyebrow">{user?.tenant?.nome || 'Instituição'} · {course?.nome || 'Curso'}</p><h1>{title}</h1><p>Informações cadastradas nesta instituição.</p></div></div>{status === 'loading' ? <p role="status">Carregando…</p> : status === 'error' ? <div className="inline-form-error" role="alert">Não foi possível carregar os dados.<button className="btn" onClick={() => void load()}>Tentar novamente</button></div> : items.length ? <div className="card">{items.map((item: any) => <article key={item.id} style={{ padding: '16px 0', borderBottom: '1px solid var(--line)' }}><h3>{item.nome}</h3>{kind === 'modules' && <><p className="muted">{item.desc}</p><small>{item.lessons?.length || 0} aulas cadastradas</small>{item.lessons?.map((lesson: any) => <p key={lesson.id}>{lesson.titulo} · {lesson.prof}</p>)}</>}{kind === 'exams' && <p>{item.data} · {item.q} questões</p>}</article>)}</div> : <div className="card"><h2>{!user?.courseId ? 'Nenhum curso associado' : 'Nenhum registro por aqui'}</h2><p className="muted">{!user?.courseId ? 'Crie um curso em Unidade e equipe para começar.' : 'Esta área está vazia. Os registros aparecerão conforme a instituição cadastrar seus dados.'}</p></div>}</section></div>;
};
