import React, { useEffect, useState } from 'react';
import { ArrowUpRight, RefreshCw, Search } from 'lucide-react';
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
    { label: 'Instituições ativas', value: active.length, detail: `${tenants.length - active.length} desativadas · ${tenants.length} no total` },
    { label: 'Usuários vinculados', value: hasCounts ? active.reduce((sum, t) => sum + t._count!.users, 0) : '—', detail: 'Contas das instituições ativas' },
    { label: 'Alunos cadastrados', value: hasCounts ? courses.reduce((sum, c) => sum + c._count!.students, 0) : '—', detail: 'Matrículas nos cursos das unidades ativas' },
    { label: 'Cursos cadastrados', value: courses.length, detail: 'Nas instituições ativas' }
  ];
  return <><TopBar currentPage="Dashboard da plataforma" /><div className="sa-dashboard">
    <header className="sa-dashboard-head"><div><p className="eyebrow">GESTÃO DA PLATAFORMA</p><h1>Visão geral do Facilita Estudos</h1><p className="muted">Instituições, acessos e implantação em um só lugar.</p></div><button className="ghost" disabled={loading} onClick={() => void load()}><RefreshCw size={16} /> {loading ? 'Atualizando…' : 'Atualizar dados'}</button></header>
    {error && <div role="alert" className="inline-form-error">{error}</div>}
    {!updatedAt ? (loading ? <p role="status">Carregando indicadores…</p> : null) : <>
      <section className="sa-metrics" aria-label="Indicadores da plataforma">{metrics.map(metric => <article key={metric.label}><span>{metric.label}</span><strong>{metric.value.toLocaleString('pt-BR')}</strong><small>{metric.detail}</small></article>)}</section>
      <section className="sa-operation"><div><p className="eyebrow">PRÓXIMOS PASSOS</p><h2>{waiting.length ? `${waiting.length} ${waiting.length === 1 ? 'instituição com' : 'instituições com'} configuração pendente` : 'Configuração das unidades em dia'}</h2><p>Verificação de cursos, equipe vinculada e logotipo. Não representa disponibilidade do servidor ou do DNS.</p></div><button className="primary" onClick={() => onNavigate('sa-tenants')}>Gerenciar instituições <ArrowUpRight size={17} /></button></section>
      {waiting.length > 0 && <div className="sa-pending">{waiting.map(t => <div key={t.id}><b>{t.nome}</b><span>{pending(t).join(' · ')}</span></div>)}</div>}
      <section className="sa-institutions"><div className="sa-table-heading"><div><h2>Instituições da plataforma</h2><p className="muted">{visible.length} de {tenants.length} instituições · atualizado às {updatedAt}</p></div><label className="sa-search"><Search size={17} /><input aria-label="Buscar instituição" placeholder="Buscar nome ou domínio" value={search} onChange={e => setSearch(e.target.value)} /></label></div>
        <div className="tenant-tabs" aria-label="Filtrar instituições">{[['all', 'Todas'], ['active', 'Ativas'], ['inactive', 'Desativadas']].map(([value, label]) => <button key={value} aria-pressed={filter === value} className={filter === value ? 'on' : ''} onClick={() => setFilter(value)}>{label}</button>)}</div>
        <div className="sa-table-scroll"><table><thead><tr><th>Instituição / domínio</th><th>Situação</th><th>Cursos</th><th>Usuários</th><th>Alunos</th></tr></thead><tbody>{visible.map(t => <tr key={t.id}><td><b>{t.nome}</b><small>{t.dominio || 'Domínio não definido'}</small></td><td><span className={`pill ${t.ativo ? 'good' : 'warn'}`}>{t.ativo ? 'Ativa' : 'Desativada'}</span></td><td>{t.courses.length}</td><td>{t._count?.users ?? '—'}</td><td>{t.courses.every(c => c._count) ? t.courses.reduce((sum, c) => sum + c._count!.students, 0) : '—'}</td></tr>)}</tbody></table></div>
        {!visible.length && <p className="sa-empty">{tenants.length ? 'Nenhuma instituição encontrada com esse filtro.' : 'Nenhuma instituição cadastrada. Comece criando sua primeira unidade.'}</p>}
        <button className="ghost" onClick={() => onNavigate('sa-tenants')}>Abrir central de instituições <ArrowUpRight size={16} /></button>
      </section><p className="sa-data-note">Contagens de registros cadastrados, sem previsões de alunos ou estimativas financeiras. Os indicadores do topo consideram somente instituições ativas.</p>
    </>}
  </div></>;
};
