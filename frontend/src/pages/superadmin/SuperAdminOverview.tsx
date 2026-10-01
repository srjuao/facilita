import React, { useEffect, useState } from 'react';
import api from '../../api/client';
import { Tenant } from '../../types';

export const SuperAdminOverview: React.FC = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);

  useEffect(() => {
    api.get('/tenants')
      .then(res => setTenants(res.data))
      .catch(err => console.error(err));
  }, []);

  return (
    <div style={{ padding: '24px' }}>
      <div className="page-head">
        <div>
          <h1>Painel Superadmin Facilita</h1>
          <p>Visão de todas as faculdades e cursos cadastrados na plataforma.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginTop: '20px' }}>
        {tenants.map(t => (
          <div key={t.id} className="card" style={{ position: 'relative', overflow: 'hidden' }}>
            <div style={{ height: '80px', margin: '-20px -20px 12px', background: `url(${t.cover}) center/cover` }} />
            <h3>{t.nome}</h3>
            <p style={{ fontSize: '12px', color: 'var(--ink-2)' }}>{t.full} · {t.cidade}</p>
            <div style={{ marginTop: '12px' }}>
              <small className="muted">Cursos ativos:</small>
              <ul style={{ paddingLeft: '18px', marginTop: '4px', fontSize: '13px' }}>
                {t.courses.map(c => (
                  <li key={c.id}>
                    <b>{c.nome}</b> — {c.alunos || c.previstos} alunos ({c.status})
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
