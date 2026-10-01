import React from 'react';
import { TopBar } from '../../components/TopBar';

export const CoordLive: React.FC = () => {
  return (
    <div>
      <TopBar currentPage="Ao vivo" />
      <div style={{ padding: '0 28px 40px' }}>
        <div className="page-head" style={{ marginBottom: '20px' }}>
          <div>
            <h1>Atividade em Tempo Real (Ao vivo)</h1>
            <p>Acompanhe o que os alunos estão estudando neste momento.</p>
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--crit)' }}></span>
            <b>14 alunos estudando agora</b>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { nome: 'Ana Paula Ribeiro', atividade: 'Assistindo aula: Semiologia Geral — Aula 2', desde: 'há 12 min' },
              { nome: 'Bruno Silva', atividade: 'Resolvendo simulado UC1', desde: 'há 4 min' },
              { nome: 'Carla Dias', atividade: 'Revisando Flash Cards de Fisiologia renal', desde: 'há 28 min' },
              { nome: 'Daniel Souza', atividade: 'Tirando dúvidas com a IA sobre Antropometria', desde: 'há 2 min' },
            ].map((st, i) => (
              <div key={i} style={{ padding: '12px', background: 'var(--paper-2)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <b>{st.nome}</b>
                  <div className="muted" style={{ fontSize: '12px' }}>{st.atividade}</div>
                </div>
                <small className="muted">{st.desde}</small>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
