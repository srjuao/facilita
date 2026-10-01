import React from 'react';
import { TopBar } from '../../components/TopBar';

export const SuperAdminFinancial: React.FC = () => {
  return (
    <div>
      <TopBar currentPage="Financeiro" />
      <div style={{ padding: '0 28px 40px' }}>
        <div className="page-head" style={{ marginBottom: '20px' }}>
          <div>
            <h1>Painel Financeiro</h1>
            <p>Faturamento, MRR, ticket médio por aluno e previsões de receita.</p>
          </div>
        </div>

        <div className="grid g4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
          <div className="card kpi">
            <span className="lab" style={{ fontSize: '12px', color: 'var(--muted)' }}>MRR Atual</span>
            <div className="val num" style={{ fontSize: '24px', fontWeight: 800 }}>R$ 138.900</div>
          </div>
          <div className="card kpi">
            <span className="lab" style={{ fontSize: '12px', color: 'var(--muted)' }}>Alunos Pagantes</span>
            <div className="val num" style={{ fontSize: '24px', fontWeight: 800 }}>886</div>
          </div>
          <div className="card kpi">
            <span className="lab" style={{ fontSize: '12px', color: 'var(--muted)' }}>Ticket Médio/Aluno</span>
            <div className="val num" style={{ fontSize: '24px', fontWeight: 800 }}>R$ 156,70</div>
          </div>
          <div className="card kpi">
            <span className="lab" style={{ fontSize: '12px', color: 'var(--muted)' }}>Crescimento MoM</span>
            <div className="val num" style={{ fontSize: '24px', fontWeight: 800, color: 'var(--good)' }}>+ 18.4%</div>
          </div>
        </div>
      </div>
    </div>
  );
};
