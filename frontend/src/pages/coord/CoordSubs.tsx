import React from 'react';
import { TopBar } from '../../components/TopBar';

export const CoordSubs: React.FC = () => (
  <div>
    <TopBar currentPage="Turmas" />
    <section className="unit-setup">
      <div className="page-head"><div><h1>Turmas</h1><p>Informações da instituição.</p></div></div>
      <div className="card" role="status"><h2>Acompanhamento ainda não disponível</h2><p className="muted">A gestão de turmas ainda não possui registros e acompanhamento integrados. Nenhuma turma ou indicador de demonstração é exibido.</p></div>
    </section>
  </div>
);
