import React, { useEffect, useState } from 'react';
import { TopBar } from '../../components/TopBar';
import api from '../../api/client';
import { Tenant } from '../../types';

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
  const courses = tenants.flatMap(tenant => tenant.courses.map(course => ({ ...course, tenantName: tenant.nome, tenantActive: tenant.ativo }))).filter(course => `${course.nome} ${course.tenantName}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')));
  return <><TopBar currentPage="Cursos cadastrados" /><section className="sa-plans">
    <header className="plans-section-heading"><div><p className="eyebrow">CONTEÚDO DA PLATAFORMA</p><h1>Cursos cadastrados</h1><p className="muted">Contagens dos registros existentes. Previsões de matrícula não são alunos cadastrados.</p></div><button className="ghost" disabled={loading} onClick={() => void load()}>Atualizar</button></header>
    {error && <div role="alert" className="inline-form-error">{error}</div>}
    <label className="plans-search">Buscar curso ou instituição<input value={search} onChange={event => setSearch(event.target.value)} /></label>
    {loading ? <p role="status">Carregando cursos…</p> : !error && <div className="finance-table-wrap"><table className="finance-table"><thead><tr><th>Curso</th><th>Instituição</th><th>Situação cadastrada</th><th>Alunos matriculados</th><th>Matérias</th><th>Videoaulas</th><th>Avaliações</th></tr></thead><tbody>{courses.map(course => <tr key={course.id}><td><b>{course.nome}</b></td><td>{course.tenantName}<small>{course.tenantActive ? 'Instituição ativa' : 'Instituição desativada'}</small></td><td>{course.status || 'Não informada'}</td><td>{course._count?.students ?? '—'}</td><td>{course._count?.modules ?? '—'}</td><td>{course.modules ? course.modules.reduce((sum, module) => sum + module._count.lessons, 0) : '—'}</td><td>{course._count?.exams ?? '—'}</td></tr>)}</tbody></table>{!courses.length && <p className="plans-empty">Nenhum curso encontrado.</p>}</div>}
  </section></>;
};
