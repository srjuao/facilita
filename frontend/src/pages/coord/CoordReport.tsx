import React from 'react';
import { TopBar } from '../../components/TopBar';

export const CoordReport: React.FC = () => {
  return (
    <div>
      <TopBar currentPage="Relatório do piloto" />
      <div style={{ padding: '0 28px 40px' }}>
        <div className="page-head" style={{ marginBottom: '20px' }}>
          <div>
            <h1>Relatório do Piloto Acadêmico</h1>
            <p>Indicadores de adoção, satisfação, engajamento e métricas de aprendizado.</p>
          </div>
        </div>

        <div className="card" style={{ background: 'var(--good-soft)', borderColor: 'var(--good)', marginBottom: '20px' }}>
          <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
            <span className="pill good">Recomendação de Expansão</span>
            <b>14 de 15 indicadores dentro da meta acordada.</b>
          </div>
        </div>

        <div className="grid g2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div className="card">
            <h3>Adoção e Engajamento</h3>
            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Alunos ativos por semana</span>
                <span className="pill good">92%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Aulas concluídas</span>
                <span className="pill good">81%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Frequência média</span>
                <span className="pill good">3,6×/sem</span>
              </div>
            </div>
          </div>

          <div className="card">
            <h3>Satisfação e Qualidade</h3>
            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Avaliação média das aulas</span>
                <span className="pill good">4,6 ★</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>NPS Acadêmico</span>
                <span className="pill good">68</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Aderência à matriz curricular</span>
                <span className="pill good">100%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
