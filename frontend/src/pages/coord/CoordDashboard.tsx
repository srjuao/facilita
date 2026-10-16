import React, { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { TopBar } from '../../components/TopBar';
import api from '../../api/client';

export const CoordDashboard: React.FC<{ onNavigate: (view: string) => void }> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [course, setCourse] = useState<any>(null);
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading');
  const load = async () => {
    setCourse(null);
    if (!user?.courseId) { setStatus('ready'); return; }
    setStatus('loading');
    try { setCourse((await api.get('/courses/' + user.courseId)).data); setStatus('ready'); }
    catch { setStatus('error'); }
  };
  useEffect(() => { void load(); }, [user?.courseId]);
  const students: any[] = course?.students || [];
  return <div><TopBar currentPage="Dashboard" /><div className="unit-setup">
    <div className="page-head"><div><p className="eyebrow">{user?.tenant?.nome || 'Instituição'}</p><h1>Dashboard de acompanhamento</h1><p>{course?.nome || 'Administração da unidade'} · somente informações cadastradas nesta instituição.</p></div></div>
    {status === 'loading' ? <p role="status">Carregando dados…</p> : status === 'error' ? <div className="inline-form-error" role="alert"><p>Não foi possível carregar os dados.</p><button className="btn" onClick={() => void load()}>Tentar novamente</button></div> : <>
      {course && <div className="grid g3">
        {[['Alunos cadastrados', students.length], ['Matérias cadastradas', course?.modules?.length || 0], ['Provas disponíveis', user?.tenant?.plan?.provas === false ? 'Não incluídas' : course?.exams?.length || 0]].map(([label, value]) => <div className="card kpi" key={label}><span className="lab">{label}</span><div className="val num">{value}</div></div>)}
      </div>}
      <section className="card" style={{ marginTop: 24 }}><h2>{!course ? 'Comece pela configuração da unidade' : students.length ? 'Acompanhamento dos alunos' : 'Este curso ainda não tem alunos'}</h2><p className="muted">{!course ? 'Cadastre os cursos da instituição e vincule os professores para iniciar a operação.' : 'Os indicadores aparecem conforme os alunos e conteúdos forem cadastrados. Ainda não há histórico de engajamento para apresentar.'}</p><button className="btn primary" onClick={() => onNavigate(!course ? 'co-setup' : 'co-alunos')}>{!course ? 'Gerenciar unidade e equipe' : 'Gerenciar alunos'}</button></section>
    </>}
  </div></div>;
};
