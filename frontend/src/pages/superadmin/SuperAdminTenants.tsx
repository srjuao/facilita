import React, { useEffect, useState } from 'react';
import { TopBar } from '../../components/TopBar';
import api from '../../api/client';
import { Tenant } from '../../types';

export const SuperAdminTenants: React.FC = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);

  useEffect(() => {
    api.get('/tenants')
      .then(res => setTenants(res.data))
      .catch(err => console.error(err));
  }, []);

  return (
    <div>
      <TopBar currentPage="Faculdades" />
      <div style={{ padding: '0 28px 40px' }}>
        <div className="page-head" style={{ marginBottom: '20px' }}>
          <div>
            <h1>Faculdades (Instituições Parceiras)</h1>
            <p>Gerenciamento de tenancies, contratos e acessos institucionais.</p>
          </div>
        </div>

        <div className="grid g3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
          {tenants.map((t) => (
            <div key={t.id} className="card">
              <h3>{t.nome}</h3>
              <p className="muted" style={{ fontSize: '12px' }}>{t.full} · {t.cidade}</p>
              <div style={{ margin: '12px 0', fontSize: '13px' }}>
                <div>Domínio: <b>{t.dominio}</b></div>
                <div>Desde: <b>{t.since}</b></div>
                <div>Responsável: <b>{t.admin}</b></div>
              </div>
              <span className="pill good">{t.courses.length} cursos ativos</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
