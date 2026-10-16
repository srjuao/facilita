import React from 'react';
import { TopBar } from '../../components/TopBar';

export const CoordLive: React.FC = () => (
  <div>
    <TopBar currentPage="Atividade em tempo real" />
    <section className="unit-setup">
      <div className="page-head"><div><h1>Atividade em tempo real</h1><p>Informações da instituição.</p></div></div>
      <div className="card" role="status"><h2>Acompanhamento ainda não disponível</h2><p className="muted">O acompanhamento em tempo real ainda não está integrado. Não é possível afirmar quantos alunos estão online ou o que estão estudando.</p></div>
    </section>
  </div>
);
