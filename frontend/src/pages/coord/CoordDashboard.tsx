import React, { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { TopBar } from '../../components/TopBar';
import { LineChart, GroupedBars, HeatmapChart, HorizontalBars } from '../../components/Charts';
import api from '../../api/client';
import { Mail, AlertTriangle, CheckCircle, Clock, BarChart3, Layers } from 'lucide-react';

export const CoordDashboard: React.FC = () => {
  const { user } = useAuth();
  const [course, setCourse] = useState<any>(null);

  useEffect(() => {
    if (user?.courseId) {
      api.get(`/courses/${user.courseId}`)
        .then(res => setCourse(res.data))
        .catch(err => console.error(err));
    }
  }, [user]);

  if (!course) return <div style={{ padding: '40px', textAlign: 'center' }}>Carregando Dashboard da Coordenação...</div>;

  const alunos = course.students || [];
  const altoRisco = alunos.filter((s: any) => s.risco === 'alto');
  const medioRisco = alunos.filter((s: any) => s.risco === 'medio');
  const emDia = alunos.filter((s: any) => s.risco === 'baixo');

  const courseName = course.nome || 'Medicina';
  const tenantName = user?.tenant?.nome || 'UNIFAN';

  return (
    <div style={{ paddingBottom: '40px' }}>
      <TopBar courseName={courseName} currentPage="Dashboard" />

      <div style={{ padding: '0 28px' }}>
        {/* Page Head */}
        <div className="page-head" style={{ marginBottom: '20px' }}>
          <div>
            <div className="eyebrow" style={{ textTransform: 'uppercase', letterSpacing: '.08em' }}>
              Facilita{courseName} · {tenantName}
            </div>
            <h1 style={{ fontSize: '28px', marginTop: '4px' }}>Dashboard de Acompanhamento</h1>
            <p>1º período · {alunos.length || 150} alunos matriculados · 17 turmas (SUBs) · piloto acadêmico 2026</p>
          </div>
        </div>

        {/* KPIs no Topo */}
        <div className="grid g4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          <div className="card kpi">
            <span className="lab" style={{ fontSize: '12px', color: 'var(--muted)' }}>Engajamento dos alunos</span>
            <div className="val num" style={{ fontSize: '28px', fontWeight: 800, marginTop: '4px' }}>88%</div>
            <small style={{ color: 'var(--good)', fontSize: '12px', fontWeight: 600 }}>132 de 150 ativos nesta semana</small>
          </div>

          <div className="card kpi">
            <span className="lab" style={{ fontSize: '12px', color: 'var(--muted)' }}>Média de estudo por semana</span>
            <div className="val num" style={{ fontSize: '28px', fontWeight: 800, marginTop: '4px' }}>3h42</div>
            <small style={{ color: 'var(--good)', fontSize: '12px', fontWeight: 600 }}>+48 min vs meta semanal</small>
          </div>

          <div className="card kpi">
            <span className="lab" style={{ fontSize: '12px', color: 'var(--muted)' }}>Nota média nos simulados</span>
            <div className="val num" style={{ fontSize: '28px', fontWeight: 800, marginTop: '4px' }}>7,1</div>
            <small style={{ color: 'var(--good)', fontSize: '12px', fontWeight: 600 }}>acima da meta de 7,0</small>
          </div>

          <div className="card kpi" style={{ borderColor: 'var(--crit)' }}>
            <span className="lab" style={{ fontSize: '12px', color: 'var(--muted)' }}>Alunos que precisam de ajuda</span>
            <div className="val num" style={{ fontSize: '28px', fontWeight: 800, color: 'var(--crit)', marginTop: '4px' }}>{altoRisco.length || 12}</div>
            <small style={{ color: 'var(--crit)', fontSize: '12px', fontWeight: 600 }}>requer intervenção da coordenação</small>
          </div>
        </div>

        {/* SEÇÃO 1: USO DA PLATAFORMA */}
        <div style={{ margin: '32px 0 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: '12px' }}>1</span>
            <h2 style={{ fontSize: '20px' }}>Os alunos estão usando a plataforma?</h2>
          </div>
          <p className="muted" style={{ fontSize: '13px', marginLeft: '34px' }}>Adesão e hábito de estudo ao longo do semestre.</p>
        </div>

        <div className="grid g32" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '24px' }}>
          {/* Gráfico de Linha de Acessos */}
          <div className="card">
            <div className="card-head" style={{ marginBottom: '14px' }}>
              <h3>Uso semana a semana</h3>
              <div className="sub" style={{ fontSize: '12px', color: 'var(--muted)' }}>Sessões de estudo da turma ao longo das 18 semanas</div>
            </div>

            <LineChart
              labels={['S1', 'S2', 'S3', 'S4', 'S5', 'S6 (Prova)', 'S7', 'S8', 'S9', 'S10', 'S11', 'S12 (Prova)', 'S13', 'S14']}
              series={[{ name: 'Sessões', color: 'var(--accent)', data: [560, 580, 595, 620, 610, 1080, 630, 650, 680, 710, 690, 1150, 730, 750] }]}
              h={210}
            />

            <div style={{ marginTop: '14px', padding: '12px', background: 'var(--paper-2)', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CheckCircle size={18} style={{ color: 'var(--good)' }} />
              <span>Em semana de prova o uso sobe <b>1,9×</b>. A plataforma virou a ferramenta de revisão da turma.</span>
            </div>
          </div>

          {/* Situação Hoje */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <h3>Situação da turma hoje</h3>
              <div className="sub" style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '16px' }}>Pelo último acesso de cada aluno</div>
              
              <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--ink)', marginBottom: '12px' }}>
                88% <small style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 500 }}>ativos na semana</small>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span>Acessou nos últimos 2 dias</span>
                  <b>{Math.round(alunos.length * 0.65) || 98} alunos</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span>Acessou na semana</span>
                  <b>{Math.round(alunos.length * 0.23) || 34} alunos</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--crit)' }}>
                  <span>Sem acesso há 7+ dias</span>
                  <b>{altoRisco.length || 18} alunos</b>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '16px', padding: '12px', background: 'var(--crit-soft)', color: 'var(--crit)', borderRadius: '8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={16} />
              <span><b>{altoRisco.length || 18} alunos</b> necessitam de acompanhamento preventivo.</span>
            </div>
          </div>
        </div>

        {/* Heatmap & Barras Agrupadas */}
        <div className="grid g32" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', marginBottom: '32px' }}>
          <div className="card">
            <h3>Em que horários a turma estuda?</h3>
            <p className="muted" style={{ fontSize: '12px', marginBottom: '14px' }}>Quanto mais escuro, mais alunos ativos naquele horário</p>
            <HeatmapChart />
            <div style={{ marginTop: '14px', fontSize: '12px', color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={16} /> O estudo concentra-se à noite (19h às 23h), com pico no domingo. Melhor horário para lembretes: <b>18h</b>.
            </div>
          </div>

          <div className="card">
            <h3>O que muda em semana de prova?</h3>
            <p className="muted" style={{ fontSize: '12px', marginBottom: '14px' }}>Minutos de estudo por aluno por tipo de conteúdo</p>
            <GroupedBars
              rows={[
                { label: 'Semiologia Geral', a: 58, b: 112 },
                { label: 'Fisiologia Humana', a: 41, b: 96 },
                { label: 'Bioquímica Médica', a: 36, b: 64 },
                { label: 'Flash cards', a: 33, b: 118 },
              ]}
            />
          </div>
        </div>

        {/* SEÇÃO 2: DIFICULDADES E ALERTAS */}
        <div style={{ margin: '32px 0 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: '12px' }}>2</span>
            <h2 style={{ fontSize: '20px' }}>Quem precisa de ajuda agora?</h2>
          </div>
          <p className="muted" style={{ fontSize: '13px', marginLeft: '34px' }}>Alunos identificados em situação de risco acadêmico.</p>
        </div>

        <div className="card">
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line)' }}>
                <th style={{ padding: '10px' }}>Aluno</th>
                <th style={{ padding: '10px' }}>Turma</th>
                <th style={{ padding: '10px' }}>Progresso</th>
                <th style={{ padding: '10px' }}>Nota Média</th>
                <th style={{ padding: '10px' }}>Situação</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>Ação Rápida</th>
              </tr>
            </thead>
            <tbody>
              {alunos.slice(0, 8).map((s: any) => (
                <tr key={s.id} style={{ borderBottom: '1px solid var(--line-2)' }}>
                  <td style={{ padding: '12px 10px' }}>
                    <b>{s.nome}</b>
                    {s.online && <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--good)' }}>● online</span>}
                  </td>
                  <td style={{ padding: '12px 10px' }}>{s.sub}</td>
                  <td style={{ padding: '12px 10px' }}>{s.progresso}%</td>
                  <td style={{ padding: '12px 10px', fontWeight: 700, color: s.nota < 6 ? 'var(--crit)' : 'inherit' }}>{s.nota}</td>
                  <td style={{ padding: '12px 10px' }}>
                    <span className={`pill ${s.risco === 'alto' ? 'crit' : s.risco === 'medio' ? 'warn' : 'good'}`}>
                      {s.risco.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '12px 10px', textAlign: 'right' }}>
                    <button className="btn sm primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Mail size={12} /> Mensagem
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
