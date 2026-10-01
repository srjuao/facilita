import React from 'react';
import { TopBar } from '../../components/TopBar';

export const CoordAlerts: React.FC = () => {
  const alerts = [
    { student: 'Gabriel Ferreira', motivo: 'Sem acesso há 12 dias', risco: 'alto', acao: 'Enviar mensagem' },
    { student: 'Mariana Santos', motivo: 'Nota 4.2 no simulado UC1', risco: 'alto', acao: 'Agendar tutoria' },
    { student: 'Lucas Oliveira', motivo: 'Queda de 40% no tempo semanal', risco: 'medio', acao: 'Acompanhar' },
  ];

  return (
    <div>
      <TopBar currentPage="Alertas" />
      <div style={{ padding: '0 28px 40px' }}>
        <div className="page-head" style={{ marginBottom: '20px' }}>
          <div>
            <h1>Alertas Acadêmicos</h1>
            <p>Alunos que necessitam de intervenção ou acompanhamento direto da coordenação.</p>
          </div>
        </div>

        <div className="card">
          <div className="list">
            {alerts.map((a, i) => (
              <div key={i} className="row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--line-2)' }}>
                <div>
                  <b style={{ fontSize: '14px' }}>{a.student}</b>
                  <div className="muted" style={{ fontSize: '12px' }}>{a.motivo}</div>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <span className={`pill ${a.risco === 'alto' ? 'crit' : 'warn'}`}>{a.risco.toUpperCase()}</span>
                  <button className="btn sm primary">{a.acao}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
