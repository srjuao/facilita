import React from 'react';
import { TopBar } from '../../components/TopBar';

export const CoordUCs: React.FC = () => {
  return (
    <div>
      <TopBar currentPage="Períodos e UCs" />
      <div style={{ padding: '0 28px 40px' }}>
        <div className="page-head" style={{ marginBottom: '20px' }}>
          <div>
            <h1>Períodos e UCs (Unidades Curriculares)</h1>
            <p>Estrutura da matriz curricular do curso.</p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {[
            { nome: 'UC1 · Anamnese e Exame Físico', desc: 'Semiologia e comunicação clínica', status: 'Publicada', aulas: 17 },
            { nome: 'UC2 · Fundamentos Biológicos', desc: 'Bioquímica, fisiologia e histologia', status: 'Publicada', aulas: 17 },
            { nome: 'UC3 · Saúde Coletiva I', desc: 'SUS, epidemiologia e atenção primária', status: 'Em andamento', aulas: 17 },
          ].map((uc, i) => (
            <div key={i} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <b style={{ fontSize: '16px' }}>{uc.nome}</b>
                  <div className="muted" style={{ fontSize: '13px' }}>{uc.desc}</div>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <span className="muted" style={{ fontSize: '13px' }}>{uc.aulas} aulas</span>
                  <span className={`pill ${uc.status === 'Publicada' ? 'good' : 'info'}`}>{uc.status}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
