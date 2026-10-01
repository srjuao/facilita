import React, { useEffect, useState } from 'react';
import { TopBar } from '../../components/TopBar';
import api from '../../api/client';
import { Tenant } from '../../types';

export const SuperAdminCourses: React.FC = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);

  useEffect(() => {
    api.get('/tenants')
      .then(res => setTenants(res.data))
      .catch(err => console.error(err));
  }, []);

  const allCourses = tenants.flatMap(t => t.courses.map(c => ({ ...c, tenantName: t.nome })));

  return (
    <div>
      <TopBar currentPage="Cursos" />
      <div style={{ padding: '0 28px 40px' }}>
        <div className="page-head" style={{ marginBottom: '20px' }}>
          <div>
            <h1>Cursos Cadastrados na Plataforma</h1>
            <p>Lista consolidada de todos os cursos ativos e em implantação nas faculdades.</p>
          </div>
        </div>

        <div className="card">
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line)' }}>
                <th style={{ padding: '10px' }}>Curso</th>
                <th style={{ padding: '10px' }}>Faculdade</th>
                <th style={{ padding: '10px' }}>Status</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>Alunos</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>Aulas</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>Adesão</th>
              </tr>
            </thead>
            <tbody>
              {allCourses.map((c, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--line-2)' }}>
                  <td style={{ padding: '12px 10px' }}><b>{c.nome}</b></td>
                  <td style={{ padding: '12px 10px' }}>{c.tenantName}</td>
                  <td style={{ padding: '12px 10px' }}>
                    <span className={`pill ${c.status === 'Ativo' ? 'good' : c.status === 'Em implantação' ? 'warn' : 'neutral'}`}>
                      {c.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 10px', textAlign: 'right' }}>{c.alunos || c.previstos}</td>
                  <td style={{ padding: '12px 10px', textAlign: 'right' }}>{c.aulas}</td>
                  <td style={{ padding: '12px 10px', textAlign: 'right' }}>{c.adesao}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
