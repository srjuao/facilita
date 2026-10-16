import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import api from '../api/client';
import { TopBar } from './TopBar';

export const CourseRecords: React.FC<{ title: string; kind: 'modules' | 'exams' | 'alerts' | 'live' | 'empty'; onOpenLesson?: (id: string) => void }> = ({ title, kind, onOpenLesson }) => {
  const { user } = useAuth();
  const [course, setCourse] = useState<any>(null);
  const [status, setStatus] = useState('loading');
  const supported = kind === 'modules' || kind === 'exams';
  const load = async () => {
    setStatus('loading'); setCourse(null);
    if (!supported || !user?.courseId) { setStatus('ready'); return; }
    try { setCourse((await api.get('/courses/' + user.courseId)).data); setStatus('ready'); }
    catch { setStatus('error'); }
  };
  useEffect(() => { let active = true; setStatus('loading'); setCourse(null); if (!supported || !user?.courseId) { setStatus('ready'); return; } api.get('/courses/' + user.courseId).then(response => { if (active) { setCourse(response.data); setStatus('ready'); } }).catch(() => { if (active) setStatus('error'); }); return () => { active = false; }; }, [user?.id, user?.courseId, supported]);
  const items = kind === 'modules' ? course?.modules || [] : kind === 'exams' ? course?.exams || [] : [];
  const unavailable = kind === 'live' ? 'O monitoramento de presença em tempo real ainda não está integrado.' : kind === 'alerts' ? 'Não há um serviço de alertas acadêmicos integrado. Nenhum risco ou aviso será estimado.' : 'Esta funcionalidade ainda não possui um serviço de dados integrado.';
  return <div><TopBar currentPage={title} /><section className="unit-setup"><div className="page-head"><div><p className="eyebrow">{user?.tenant?.nome || 'Instituição'}{course?.nome ? ' · ' + course.nome : ''}</p><h1>{title}</h1><p>{supported ? 'Informações cadastradas nesta instituição.' : 'Nenhuma informação de demonstração é exibida.'}</p></div></div>
    {!supported ? <section className="card"><h2>Funcionalidade ainda não disponível</h2><p className="muted">{unavailable}</p></section> : status === 'loading' ? <p role="status">Carregando…</p> : status === 'error' ? <div className="inline-form-error" role="alert">Não foi possível carregar os dados.<button className="btn" onClick={() => void load()}>Tentar novamente</button></div> : items.length ? <div className="card">{items.map((item: any) => <article key={item.id} style={{ padding: '16px 0', borderBottom: '1px solid var(--line)' }}><h3>{item.nome}</h3>{kind === 'modules' && <><p className="muted">{item.desc}</p><small>{item.lessons?.length ?? 0} aulas cadastradas</small>{item.lessons?.map((lesson: any) => <p key={lesson.id}>{onOpenLesson ? <button className="ghost" onClick={() => onOpenLesson(lesson.id)}>{lesson.titulo}</button> : lesson.titulo}{lesson.prof ? ' · ' + lesson.prof : ''}</p>)}</>}{kind === 'exams' && <p>{item.data ? item.data + ' · ' : ''}{item._count?.questions === undefined ? 'Quantidade de questões não disponível' : item._count.questions + ' questões cadastradas'}</p>}</article>)}</div> : <div className="card"><h2>{!user?.courseId ? 'Nenhum curso associado' : 'Nenhum registro por aqui'}</h2><p className="muted">{!user?.courseId ? user?.role === 'aluno' ? 'Solicite à coordenação o vínculo com um curso.' : 'Cadastre um curso em Unidade e equipe para começar.' : 'Os registros aparecerão conforme a instituição cadastrar seus dados.'}</p></div>}
  </section></div>;
};
