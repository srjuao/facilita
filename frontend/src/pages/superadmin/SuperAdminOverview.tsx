import React, { useEffect, useState } from 'react';
import { ArrowUpRight, BookOpen, Building2, CheckCircle2, GraduationCap, RefreshCw, Search, Users } from 'lucide-react';
import api from '../../api/client';
import { Tenant } from '../../types';
import { TopBar } from '../../components/TopBar';
import './SuperAdminOverview.css';

export const SuperAdminOverview: React.FC<{ onNavigate: (view: string) => void }> = ({ onNavigate }) => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [updatedAt, setUpdatedAt] = useState('');
  const load = async () => {
    setLoading(true); setError('');
    try { setTenants((await api.get('/tenants')).data); setUpdatedAt(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })); }
    catch { setError('Não foi possível atualizar o dashboard. Tente novamente.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const active = tenants.filter(t => t.ativo);
  const courses = active.flatMap(t => t.courses);
  const pending = (t: Tenant) => [!t.courses.length && 'Cadastrar cursos', t._count?.users === 0 && 'Vincular equipe', !t.logoUrl && 'Personalizar marca'].filter(Boolean) as string[];
  const waiting = active.filter(t => pending(t).length);
  const visible = tenants.filter(t => (filter === 'all' || (filter === 'active' ? t.ativo : !t.ativo)) && `${t.nome} ${t.full} ${t.dominio}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')));
  const hasCounts = tenants.every(t => t._count && t.courses.every(c => c._count));
  const metrics = [
    { label: 'Instituições ativas', icon: Building2, value: active.length, detail: `${tenants.length - active.length} desativadas · ${tenants.length} no total` },
    { label: 'Usuários vinculados', icon: Users, value: hasCounts ? active.reduce((sum, t) => sum + t._count!.users, 0) : '—', detail: 'Contas das instituições ativas' },
    { label: 'Alunos cadastrados', icon: GraduationCap, value: hasCounts ? courses.reduce((sum, c) => sum + c._count!.students, 0) : '—', detail: 'Matrículas nos cursos das unidades ativas' },
    { label: 'Cursos cadastrados', icon: BookOpen, value: courses.length, detail: 'Nas instituições ativas' }
  ];
  return <><TopBar currentPage="Dashboard da plataforma" /><div className="sa-dashboard">
    <header className="sa-dashboard-head"><div><p className="eyebrow">GESTÃO DA PLATAFORMA</p><h1>Uma visão de toda a operação.</h1><p className="muted">Acompanhe suas instituições e organize os próximos passos.</p></div><div className="sa-dashboard-refresh">{updatedAt && <span>Última atualização às {updatedAt}</span>}<button className="ghost" disabled={loading} onClick={() => void load()}><RefreshCw size={16} className={loading ? 'sa-refreshing' : undefined} aria-hidden="true" /> {loading ? 'Atualizando…' : 'Atualizar dados'}</button></div></header>
    {error && <div role="alert" className="inline-form-error">{error}</div>}
    {!updatedAt ? (loading ? <div className="sa-loading-state" role="status"><RefreshCw size={24} className="sa-refreshing" aria-hidden="true" /><span>Preparando sua visão da plataforma…</span></div> : null) : <>
      <section className="sa-metrics" aria-label="Indicadores da plataforma">{metrics.map(metric => <article key={metric.label}><div className="sa-metric-label"><span>{metric.label}</span><metric.icon size={19} aria-hidden="true" /></div><strong>{metric.value.toLocaleString('pt-BR')}</strong><small>{metric.detail}</small></article>)}</section>
      <section className="sa-operation"><div className="sa-operation-copy"><span className="sa-operation-icon"><CheckCircle2 size={25} aria-hidden="true" /></span><div><p className="eyebrow">PRÓXIMOS PASSOS</p><h2>{waiting.length ? `${waiting.length} ${waiting.length === 1 ? 'instituição precisa' : 'instituições precisam'} da sua atenção` : active.length ? 'Configuração das unidades em dia' : 'Sua próxima instituição começa aqui'}</h2><p>{active.length ? 'Confira cursos, equipe e identidade visual para completar a configuração.' : 'Cadastre uma instituição e organize sua equipe, seus cursos e sua marca.'}</p></div></div><button className="primary" onClick={() => onNavigate('sa-tenants')}>Gerenciar instituições <ArrowUpRight size={17} aria-hidden="true" /></button></section>
      {waiting.length > 0 && <div className="sa-pending" aria-label="Configurações pendentes">{waiting.map(t => <div key={t.id}><b>{t.nome}</b><span>{pending(t).map(task => <small key={task}>{task}</small>)}</span></div>)}</div>}
      <section className="sa-institutions"><div className="sa-table-heading"><div><p className="eyebrow">DIRETÓRIO</p><h2>Instituições da plataforma <span className="sa-count">{tenants.length}</span></h2><p className="muted">Consulte a situação e os registros de cada unidade.</p></div><label className="sa-search"><Search size={17} aria-hidden="true" /><input aria-label="Buscar instituição" placeholder="Buscar nome ou domínio" value={search} onChange={e => setSearch(e.target.value)} /></label></div>
        <div className="tenant-tabs" aria-label="Filtrar instituições">{[['all', 'Todas'], ['active', 'Ativas'], ['inactive', 'Desativadas']].map(([value, label]) => <button key={value} aria-pressed={filter === value} className={filter === value ? 'on' : ''} onClick={() => setFilter(value)}>{label}</button>)}</div>
        <div className="sa-table-scroll" role="region" aria-label="Instituições cadastradas" tabIndex={0}><table><thead><tr><th scope="col">Instituição / domínio</th><th scope="col">Situação</th><th scope="col">Cursos</th><th scope="col">Usuários</th><th scope="col">Alunos</th></tr></thead><tbody>{visible.map(t => <tr key={t.id}><td><div className="sa-institution-cell"><span className="sa-institution-monogram" aria-hidden="true">{t.nome.slice(0, 1).toLocaleUpperCase('pt-BR')}</span><div><b>{t.nome}</b><small>{t.dominio || 'Domínio não definido'}</small></div></div></td><td><span className={`pill ${t.ativo ? 'good' : 'warn'}`}>{t.ativo ? 'Ativa' : 'Desativada'}</span></td><td>{t.courses.length}</td><td>{t._count?.users ?? '—'}</td><td>{t.courses.every(c => c._count) ? t.courses.reduce((sum, c) => sum + c._count!.students, 0) : '—'}</td></tr>)}</tbody></table></div>
        {!visible.length && <div className="sa-empty"><Building2 size={30} aria-hidden="true" /><h3>{tenants.length ? 'Nenhuma instituição encontrada' : 'Seu diretório ainda está vazio'}</h3><p>{tenants.length ? 'Tente outro nome ou ajuste o filtro de situação.' : 'Crie sua primeira instituição para acompanhar a operação por aqui.'}</p></div>}
        <footer className="sa-directory-footer"><span>{visible.length} de {tenants.length} instituições</span><button className="ghost" onClick={() => onNavigate('sa-tenants')}>Abrir central de instituições <ArrowUpRight size={16} aria-hidden="true" /></button></footer>
      </section><p className="sa-data-note">Indicadores calculados com registros das instituições ativas. A configuração não representa a disponibilidade do servidor ou do domínio.</p>
    </>}
  </div></>;
};
