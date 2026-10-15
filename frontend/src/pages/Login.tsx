import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { WordMark } from '../components/WordMark';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('joao.silva@aluno.unifan.edu.br');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      await login(email, password);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao realizar login.');
    }
  };

  return (
    <div className="login">
      <div className="login-art">
        <div className="logo-row">
          <div>
            <WordMark />
            <div style={{ fontSize: '12px', letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.78)', marginTop: '2px' }}>
              Plataforma multi-instituição
            </div>
          </div>
        </div>
        <div>
          <div className="login-art-kicker">Inteligência que aproxima</div>
          <h1>O espaço certo para cada jornada acadêmica.</h1>
          <p className="lead">
            Uma plataforma para a instituição, coordenação e alunos seguirem juntos — com clareza, contexto e evolução em cada etapa.
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
          <h2 style={{ marginTop: '6px' }}>Bem-vindo de volta</h2>
          <p className="login-subtitle">Acesse sua instituição para continuar.</p>
          
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
            <input
              id="senha"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <button className="btn primary wide login-submit" style={{ marginTop: '18px' }} type="submit">
            Acessar plataforma
          </button>

        </form>
      </div>
    </div>
  );
};
