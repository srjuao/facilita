import React from 'react';
import { TopBar } from '../../components/TopBar';

export const CoordExams: React.FC = () => {
  return (
    <div>
      <TopBar currentPage="Provas e simulados" />
      <div style={{ padding: '0 28px 40px' }}>
        <div className="page-head" style={{ marginBottom: '20px' }}>
          <div>
            <h1>Provas e Simulados</h1>
            <p>Gerenciamento de simulados, questões com maior taxa de erro e métricas de avaliação.</p>
          </div>
        </div>

        <div className="card" style={{ marginBottom: '20px' }}>
          <h3>Questões Mais Erradas da Turma</h3>
          <div className="list" style={{ marginTop: '12px' }}>
            {[
              { id: 1, topic: 'Fisiologia renal', erro: '61%', mod: 'Fisiologia Humana' },
              { id: 2, topic: 'Sinais vitais', erro: '54%', mod: 'Semiologia Geral' },
              { id: 3, topic: 'Exame físico cardiovascular', erro: '47%', mod: 'Semiologia Geral' },
              { id: 4, topic: 'Fisiologia respiratória', erro: '44%', mod: 'Fisiologia Humana' },
            ].map((q) => (
              <div key={q.id} className="row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--line-2)' }}>
                <div>
                  <b>Q{q.id} · {q.topic}</b>
                  <div className="muted" style={{ fontSize: '12px' }}>{q.mod}</div>
                </div>
                <span className="pill crit">{q.erro} erram</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
