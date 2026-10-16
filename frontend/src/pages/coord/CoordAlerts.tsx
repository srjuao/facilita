import React from 'react';
import { TopBar } from '../../components/TopBar';

export const CoordAlerts: React.FC = () => (
  <div>
    <TopBar currentPage="Alertas acadêmicos" />
    <section className="unit-setup">
      <div className="page-head"><div><h1>Alertas acadêmicos</h1><p>Informações da instituição.</p></div></div>
      <div className="card" role="status"><h2>Acompanhamento ainda não disponível</h2><p className="muted">Os alertas dependem de eventos de aprendizagem e regras de acompanhamento integrados. Ainda não há um serviço de alertas disponível.</p></div>
    </section>
  </div>
);
