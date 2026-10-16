import React from 'react';
import { TopBar } from '../../components/TopBar';

export const CoordReport: React.FC = () => (
  <div>
    <TopBar currentPage="Relatórios acadêmicos" />
    <section className="unit-setup">
      <div className="page-head"><div><h1>Relatórios acadêmicos</h1><p>Informações da instituição.</p></div></div>
      <div className="card" role="status"><h2>Acompanhamento ainda não disponível</h2><p className="muted">Os indicadores de engajamento e aprendizagem ainda não possuem uma fonte de medição integrada. Nenhuma estimativa ou recomendação automática será apresentada como resultado real.</p></div>
    </section>
  </div>
);
