import React from 'react';
import { TopBar } from '../../components/TopBar';

export const StudentStudyPlan: React.FC = () => {
  const planDays = [
    {
      dia: 'Hoje (Segunda-feira)',
      tasks: [
        { title: 'Assistir Aula 3: Semiologia Geral', mod: 'Semiologia Geral', min: 45, done: true, color: '#2A78D6' },
        { title: 'Revisar 30 flash cards prioritários', mod: 'Fisiologia Humana', min: 25, done: false, color: '#eb6834' },
        { title: 'Resolver 10 questões sobre Fisiologia renal', mod: 'Fisiologia Humana', min: 30, done: false, color: '#eb6834' },
      ]
    },
    {
      dia: 'Amanhã (Terça-feira)',
      tasks: [
        { title: 'Assistir Aula 2: Fisiologia Cardíaca', mod: 'Fisiologia Humana', min: 60, done: false, color: '#eb6834' },
        { title: 'Leitura complementar de Bioquímica', mod: 'Bioquímica Médica', min: 40, done: false, color: '#1baf7a' },
      ]
    }
  ];

  return (
    <div>
      <TopBar currentPage="Plano de estudos" />
      <div style={{ padding: '0 28px 40px' }}>
        <div className="page-head" style={{ marginBottom: '20px' }}>
          <div>
            <h1>Plano de estudos personalizado</h1>
            <p>Atividades geradas dinamicamente com base nas suas dificuldades e calendário de provas.</p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {planDays.map((d, idx) => (
            <div key={idx} className="card">
              <h3>{d.dia}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '14px' }}>
                {d.tasks.map((t, i) => (
                  <label 
                    key={i} 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '12px', 
                      padding: '12px 14px', 
                      borderLeft: `4px solid ${t.color}`, 
                      background: 'var(--paper-2)', 
                      borderRadius: '8px',
                      textDecoration: t.done ? 'line-through' : 'none',
                      opacity: t.done ? 0.7 : 1
                    }}
                  >
                    <input type="checkbox" defaultChecked={t.done} style={{ width: 'auto' }} />
                    <div style={{ flex: 1 }}>
                      <b>{t.title}</b>
                      <div className="muted" style={{ fontSize: '12px' }}>{t.mod} · {t.min} min</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
