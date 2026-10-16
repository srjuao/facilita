import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { WordMark } from '../components/WordMark';
import { Tenant } from '../types';

export const Login: React.FC<{ superAdmin?: boolean }> = ({ superAdmin = false }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [brand, setBrand] = useState<Tenant | null>(null);
  const loginVideo = Boolean(brand?.loginImageUrl && /\.mp4(?:\?|$)/i.test(brand.loginImageUrl));

  useEffect(() => {
    fetch('/api/public/tenant-branding')
      .then(response => response.status === 204 ? null : response.json())
      .then((data) => {
        if (!data) return;
        setBrand(data);
        document.title = data.browserTitle || `${data.nome} | FacilitaEstudos`;
        if (data.faviconUrl) {
          let icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
          if (!icon) { icon = document.createElement('link'); icon.rel = 'icon'; document.head.appendChild(icon); }
          icon.href = data.faviconUrl;
        }
      })
      .catch(() => undefined);
  }, []);

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
    <div className="login" style={brand ? { '--login-accent': brand.primaryColor } as React.CSSProperties : undefined}>
      <div className="login-art" style={loginVideo ? { backgroundImage: 'none', backgroundColor: '#102448' } : brand?.loginImageUrl ? { backgroundImage: `linear-gradient(90deg, rgba(0,0,0,.45), rgba(0,0,0,.15)), url("${brand.loginImageUrl}")` } : undefined}>
        {loginVideo && <video className="login-art-video" src={brand?.loginImageUrl} autoPlay muted loop playsInline />}
        <div className="logo-row">
          <div>
            {brand?.logoUrl ? <img className="tenant-login-logo" src={brand.logoUrl} alt={`Logotipo ${brand.nome}`} /> : <WordMark />}
            <div style={{ fontSize: '12px', letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.78)', marginTop: '2px' }}>
              {brand ? brand.nome : superAdmin ? 'Painel de superadmin' : 'Plataforma multi-instituição'}
            </div>
          </div>
        </div>
        <div>
          <div className="login-art-kicker">{brand ? brand.loginKicker || 'Conhecimento que conecta' : superAdmin ? 'Operação da plataforma' : 'Inteligência que aproxima'}</div>
          <h1 style={{ whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{brand ? brand.loginTitle || `Uma experiência feita para ${brand.nome}.` : superAdmin ? 'A visão central para cada instituição.' : 'O espaço certo para cada jornada acadêmica.'}</h1>
          <p className="lead" style={{ whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>
            {brand?.loginDescription || (superAdmin ? 'Gerencie faculdades, acessos, domínios e identidade de cada unidade com segurança e contexto.' : 'Uma plataforma para a instituição, coordenação e alunos seguirem juntos — com clareza, contexto e evolução em cada etapa.')}
          </p>
          <div className="brand-list">
            {(superAdmin ? ['Faculdades', 'Acessos', 'Domínios', 'Identidade'] : ['Medicina', 'Odontologia', 'Enfermagem', 'Direito', 'Psicologia', 'Fisioterapia']).map((c) => (
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
          <div className="eyebrow">{superAdmin ? 'Painel de superadmin' : 'Entrar'}</div>
          <h2 style={{ marginTop: '6px' }}>{superAdmin ? 'Acesse a operação' : 'Bem-vindo de volta'}</h2>
          <p className="login-subtitle">{superAdmin ? 'Use suas credenciais exclusivas para gerenciar a plataforma.' : 'Acesse sua instituição para continuar.'}</p>
          
          <div className="field">
            <label htmlFor="email">{superAdmin ? 'E-mail de superadmin' : 'E-mail institucional'}</label>
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
            {superAdmin ? 'Acessar painel' : 'Acessar plataforma'}
          </button>

        </form>
      </div>
    </div>
  );
};
