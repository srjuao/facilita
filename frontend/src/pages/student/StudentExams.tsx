import React, { useState } from 'react';
import { TopBar } from '../../components/TopBar';
import { LineChart } from '../../components/Charts';
import { Play } from 'lucide-react';

export const StudentExams: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'provas' | 'simulado'>('provas');

  const exams = [
    { nome: 'Simulado UC1 · Semiologia Geral e Fisiologia', data: '12/09/2026', q: 30, nota: '7,4', media: '7,1', tempo: '36 min', erro: 'Sinais vitais' },
    { nome: 'Simulado UC1 · Bioquímica Médica', data: '19/09/2026', q: 20, nota: '8,1', media: '7,8', tempo: '22 min', erro: 'Enzimas clínicas' },
    { nome: 'Simulado UC2 · Fisiologia Humana', data: '03/10/2026', q: 30, nota: '6,4', media: '6,4', tempo: '41 min', erro: 'Fisiologia renal' },
    { nome: 'Simulado UC2 · Atenção Primária', data: '10/10/2026', q: 15, nota: '7,0', media: '7,5', tempo: '31 min', erro: 'ESF e Prevenção' },
    { nome: 'Prova integradora · UC1 + UC2', data: '24/10/2026', q: 50, nota: '—', media: '—', tempo: '—', futura: true },
  ];

  const questions = [
    { id: 1, topic: 'Sinais vitais', mod: 'Semiologia Geral', enunciado: 'Sobre sinais vitais, assinale a alternativa correta em relação à aferição da pressão arterial:', erro: 61 },
    { id: 2, topic: 'Fisiologia renal', mod: 'Fisiologia Humana', enunciado: 'Qual mecanismo compensatório primário é ativado na redução da perfusão renal?', erro: 54 },
    { id: 3, topic: 'Exame físico cardiovascular', mod: 'Semiologia Geral', enunciado: 'Em relação aos sopros cardíacos e focos de ausculta, identifique a opção correta:', erro: 47 },
    { id: 4, topic: 'Fisiologia respiratória', mod: 'Fisiologia Humana', enunciado: 'Como a curva de dissociação da hemoglobina responde ao aumento da PCO2 e redução do pH?', erro: 44 },
    { id: 5, topic: 'Enzimas clínicas', mod: 'Bioquímica Médica', enunciado: 'Assinale a alternativa referente aos marcadores enzimáticos de necrose miocárdica:', erro: 39 },
  ];

  return (
    <div>
      <TopBar currentPage="Provas" />
      <div style={{ padding: '0 28px 40px' }}>
        <div className="page-head" style={{ marginBottom: '20px' }}>
          <div>
            <h1>Provas e Simulados</h1>
            <p>Simulados por UC com correção comentada. Sua média: 7,1 · turma: 7,2.</p>
          </div>
        </div>

        {/* Tabela de Provas */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <h3>Avaliações Agendadas e Realizadas</h3>
          <div className="tbl-wrap" style={{ marginTop: '14px' }}>
            <table className="tbl" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--line)' }}>
                  <th style={{ padding: '10px' }}>Avaliação</th>
                  <th style={{ padding: '10px' }}>Data</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>Questões</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>Sua nota</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>Média Turma</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>Seu tempo</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {exams.map((p, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--line-2)' }}>
                    <td style={{ padding: '12px 10px' }}>
                      <b>{p.nome}</b>
                      {p.erro && <div className="muted" style={{ fontSize: '12px' }}>Dificuldade identificada: {p.erro}</div>}
                    </td>
                    <td style={{ padding: '12px 10px' }} className="muted">{p.data}</td>
                    <td style={{ padding: '12px 10px', textAlign: 'right' }} className="num">{p.q}</td>
                    <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 700 }} className="num">{p.nota}</td>
                    <td style={{ padding: '12px 10px', textAlign: 'right' }} className="num muted">{p.media}</td>
                    <td style={{ padding: '12px 10px', textAlign: 'right' }} className="num">{p.tempo}</td>
                    <td style={{ padding: '12px 10px', textAlign: 'right' }}>
                      {p.futura ? (
                        <button className="btn sm primary">Planejar revisão</button>
                      ) : (
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button className="btn sm">Ver correção</button>
                          <button className="btn sm primary">Refazer</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Banco de Questões */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h2>Banco de Questões Comentadas</h2>
              <div className="sub" style={{ fontSize: '12px', color: 'var(--muted)' }}>Pratique e teste seu conhecimento por tópico</div>
            </div>
            <button className="btn sm primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Play size={14} fill="currentColor" /> Simulado com todas
            </button>
          </div>

          <div className="grid g2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {questions.map((q) => (
              <div key={q.id} className="card qcard" style={{ padding: '14px', display: 'flex', gap: '12px', alignItems: 'flex-start', border: '1px solid var(--line)' }}>
                <span className="rank" style={{ background: 'var(--accent-soft)', color: 'var(--accent-ink)', padding: '4px 8px', borderRadius: '6px', fontWeight: 700 }}>
                  {q.id}
                </span>
                <div style={{ flex: 1 }}>
                  <b style={{ fontSize: '13px' }}>{q.topic}</b>
                  <div className="muted" style={{ fontSize: '12px', marginTop: '2px' }}>{q.enunciado}</div>
                  <div style={{ marginTop: '8px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span className="pill neutral" style={{ fontSize: '11px' }}>{q.mod}</span>
                    <span className={`pill ${q.erro > 50 ? 'crit' : 'warn'}`} style={{ fontSize: '11px' }}>{q.erro}% erram</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Evolução das Notas */}
        <div className="card">
          <h3>Evolução das Notas nos Simulados</h3>
          <p className="muted" style={{ fontSize: '12px', marginBottom: '16px' }}>Sua nota em relação à média da turma em cada avaliação</p>
          <LineChart
            labels={['Simulado 1', 'Simulado 2', 'Simulado 3', 'Simulado 4']}
            series={[
              { name: 'Você', color: 'var(--accent)', data: [7.4, 8.1, 6.4, 7.0] },
              { name: 'Média da Turma', color: 'var(--warn)', data: [7.1, 7.8, 6.4, 7.5] }
            ]}
            h={180}
          />
        </div>
      </div>
    </div>
  );
};
