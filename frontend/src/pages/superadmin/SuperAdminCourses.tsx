import React, { useEffect, useState } from 'react';
import { BookOpen, RefreshCw, Search } from 'lucide-react';
import { TopBar } from '../../components/TopBar';
import api from '../../api/client';
import { Tenant } from '../../types';
import './SuperAdminOverview.css';

export const SuperAdminCourses: React.FC = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const load = async () => {
    setLoading(true); setError('');
    try { setTenants((await api.get('/tenants')).data); }
    catch { setError('Não foi possível carregar os cursos. Nenhuma contagem foi estimada.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const activeTenants = tenants.filter(tenant => tenant.ativo);
  const allCourses = activeTenants.flatMap(tenant => tenant.courses.map(course => ({ ...course, tenantName: tenant.nome, tenantActive: tenant.ativo })));
  const courses = allCourses.filter(course => `${course.nome} ${course.tenantName}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')));
  return <><TopBar currentPage="Cursos cadastrados" /><section className="sa-dashboard">
    <header className="sa-dashboard-head"><div><p className="eyebrow">CONTEÚDO DA PLATAFORMA</p><h1>O ensino, em perspectiva.</h1><p className="muted">Consulte os cursos e acompanhe a estrutura acadêmica de cada instituição.</p>{!loading && !error && <div className="sa-course-summary"><span><b>{allCourses.length}</b> cursos cadastrados</span><span><b>{activeTenants.filter(tenant => tenant.courses.length > 0).length}</b> instituições com cursos</span></div>}</div><button className="ghost" disabled={loading} onClick={() => void load()}><RefreshCw size={16} aria-hidden="true" className={loading ? 'sa-refreshing' : undefined} />{loading ? 'Atualizando…' : 'Atualizar dados'}</button></header>
    {error && <div role="alert" className="inline-form-error">{error}</div>}
    {loading ? <div role="status" className="sa-loading-state"><RefreshCw size={24} className="sa-refreshing" aria-hidden="true" /><span>Organizando os cursos da plataforma…</span></div> : !error && <section className="sa-institutions sa-courses-directory"><div className="sa-table-heading"><div><p className="eyebrow">ESTRUTURA ACADÊMICA</p><h2>Todos os cursos <span className="sa-count">{allCourses.length}</span></h2><p className="muted">Matrículas e conteúdos efetivamente cadastrados.</p></div><label className="sa-search"><Search size={17} aria-hidden="true" /><input aria-label="Buscar curso ou instituição" placeholder="Buscar curso ou instituição" value={search} onChange={event => setSearch(event.target.value)} /></label></div><div className="sa-table-scroll" role="region" aria-label="Cursos cadastrados" tabIndex={0}><table><thead><tr><th scope="col">Curso</th><th scope="col">Instituição</th><th scope="col">Situação</th><th scope="col">Alunos</th><th scope="col">Matérias</th><th scope="col">Videoaulas</th><th scope="col">Avaliações</th></tr></thead><tbody>{courses.map(course => <tr key={course.id}><td><div className="sa-course-title"><BookOpen size={17} aria-hidden="true" /><b>{course.nome}</b></div></td><td>{course.tenantName}<small>{course.tenantActive ? 'Instituição ativa' : 'Instituição desativada'}</small></td><td>{course.status || 'Não informada'}</td><td>{course._count?.students ?? '—'}</td><td>{course._count?.modules ?? '—'}</td><td>{course.modules ? course.modules.reduce((sum, module) => sum + module._count.lessons, 0) : '—'}</td><td>{course._count?.exams ?? '—'}</td></tr>)}</tbody></table></div>{!courses.length && <div className="sa-empty"><BookOpen size={30} aria-hidden="true" /><h3>{allCourses.length ? 'Nenhum curso encontrado' : 'O primeiro curso ainda está por vir'}</h3><p>{allCourses.length ? 'Tente buscar por outro nome de curso ou instituição.' : 'Quando uma instituição cadastrar seus cursos, a estrutura aparecerá aqui.'}</p></div>}<footer className="sa-directory-footer"><span>{courses.length} de {allCourses.length} cursos</span></footer></section>}
    <p className="sa-data-note">As contagens consideram registros cadastrados, não previsões de matrícula. Um traço indica que a contagem não foi disponibilizada.</p>
  </section></>;
};
