import React from 'react';
import { TopBar } from '../../components/TopBar';

export const CoordSubs: React.FC = () => {
  const subs = [
    { id: 'SUB 01', alunos: 38, progresso: '82%', media: '7,4', altoRisco: 2, engajamento: 'Alto' },
    { id: 'SUB 02', alunos: 37, progresso: '74%', media: '6,9', altoRisco: 5, engajamento: 'Médio' },
    { id: 'SUB 03', alunos: 35, progresso: '68%', media: '6,4', altoRisco: 8, engajamento: 'Atenção' },
  ];

  return (
    <div>
      <TopBar currentPage="Turmas (SUBs)" />
      <div style={{ padding: '0 28px 40px' }}>
        <div className="page-head" style={{ marginBottom: '20px' }}>
          <div>
            <h1>Turmas (SUBs)</h1>
            <p>Comparativo de desempenho entre as turmas do período.</p>
          </div>
        </div>

        <div className="grid g3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
          {subs.map((sub) => (
            <div key={sub.id} className="card">
              <h3>{sub.id}</h3>
              <p className="muted" style={{ fontSize: '13px' }}>{sub.alunos} alunos matriculados</p>
              <div style={{ margin: '14px 0', fontSize: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div>Progresso Médio: <b>{sub.progresso}</b></div>
                <div>Nota Média: <b>{sub.media}</b></div>
                <div>Alunos Alto Risco: <b style={{ color: 'var(--crit)' }}>{sub.altoRisco}</b></div>
              </div>
              <span className={`pill ${sub.engajamento === 'Alto' ? 'good' : sub.engajamento === 'Médio' ? 'warn' : 'crit'}`}>
                {sub.engajamento} Engajamento
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
