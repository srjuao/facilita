import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { WordMark } from '../components/WordMark';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('joao.silva@aluno.unifan.edu.br');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      await login(email);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao realizar login.');
    }
  };

  const demoAccounts = [
    { label: 'Superadmin Facilita', email: 'admin@facilita.app', desc: 'superadmin', img: 33 },
    { label: 'Coordenação · UNIFAN Medicina', email: 'coordenacao@unifan.edu.br', desc: 'coordenacao@unifan.edu.br → FacilitaMed', img: 47 },
    { label: 'Aluno · João Silva', email: 'joao.silva@aluno.unifan.edu.br', desc: 'joao.silva@aluno.unifan.edu.br → FacilitaMed', img: 12 },
    { label: 'Coordenação · UniSerra Odontologia', email: 'coordenacao@uniserra.edu.br', desc: 'coordenacao@uniserra.edu.br → Facilita Odonto', img: 56 },
    { label: 'Aluna · Ana Paula Ribeiro', email: 'ana.ribeiro@aluno.uniserra.edu.br', desc: 'ana.ribeiro@aluno.uniserra.edu.br → Facilita Odonto', img: 25 },
  ];

  return (
    <div className="login">
      <div className="login-art">
        <div className="logo-row">
          <div>
            <WordMark />
            <div style={{ fontSize: '12px', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--accent-ink)', marginTop: '2px' }}>
              Plataforma multi-instituição
            </div>
          </div>
        </div>
        <div>
          <h1>Apoio acadêmico que a coordenação consegue medir.</h1>
          <p className="lead">
            Uma plataforma, várias faculdades. Cada curso ganha a sua marca, o seu acervo e um painel de acompanhamento de alunos em tempo real — uso, tempo de estudo, notas, dificuldades e picos em semana de prova.
          </p>
          <div className="brand-list">
            {['Medicina', 'Odontologia', 'Enfermagem', 'Direito', 'Psicologia', 'Fisioterapia'].map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--ink-2)' }}>
          Aplicação Full-Stack TypeScript · FacilitaEstudos 2026
        </div>
      </div>

      <div className="login-form">
        <form className="login-card" onSubmit={handleSubmit}>
          <div className="eyebrow">Entrar</div>
          <h2 style={{ marginTop: '6px' }}>Acesse a sua instituição</h2>
          
          <div className="field">
            <label htmlFor="email">E-mail institucional</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {error && (
            <div style={{ marginTop: '10px', padding: '8px 12px', borderRadius: '8px', background: 'var(--crit-soft)', color: 'var(--crit)', fontSize: '12px', fontWeight: 600 }}>
              {error}
            </div>
          )}

          <div className="field">
            <label htmlFor="senha">Senha</label>
            <input id="senha" type="password" defaultValue="facilita2026" />
          </div>

          <button className="btn primary wide" style={{ marginTop: '16px' }} type="submit">
            Entrar
          </button>

          <div className="demo">
            <div className="eyebrow">Contas de demonstração</div>
            <p className="muted" style={{ fontSize: '12px', marginTop: '4px' }}>
              Clique para preencher o e-mail de teste:
            </p>
            <div className="demo-grid">
              {demoAccounts.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  className="demo-btn"
                  onClick={() => {
                    setEmail(acc.email);
                    login(acc.email);
                  }}
                >
                  <span className="avatar">
                    <img src={`https://i.pravatar.cc/96?img=${acc.img}`} alt="" />
                  </span>
                  <span>
                    <b>{acc.label}</b>
                    <small>{acc.desc}</small>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
