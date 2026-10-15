import React from 'react';
import { useAuth } from '../../auth/AuthContext';
import { TopBar } from '../../components/TopBar';

export const StudentProfile: React.FC = () => {
  const { user } = useAuth();

  return (
    <div>
      <TopBar currentPage="Perfil" />
      <div style={{ padding: '0 28px 40px' }}>
        <div className="page-head" style={{ marginBottom: '20px' }}>
          <div>
            <h1>Perfil do Estudante</h1>
          </div>
        </div>

        <div className="grid g12" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
          <div className="card" style={{ textAlign: 'center' }}>
            <div className="avatar" style={{ width: '72px', height: '72px', fontSize: '22px', margin: '0 auto' }}>
              <span>{user?.nome?.slice(0, 1)}</span>
            </div>
            <b style={{ display: 'block', fontSize: '18px', marginTop: '14px' }}>{user?.nome}</b>
            <small className="muted">{user?.course?.nome || 'Sem curso associado'}</small>

            <div style={{ marginTop: '16px', display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <span className="pill info">{user?.tenant?.nome || 'Instituição'}</span>
            </div>
          </div>

          <div className="card">
            <h3>Dados Cadastrais</h3>
            <div className="grid g2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginTop: '14px' }}>
              <div className="field">
                <label>Nome completo</label>
                <input value={user?.nome || ''} readOnly />
              </div>
              <div className="field">
                <label>E-mail institucional</label>
                <input value={user?.email || ''} readOnly />
              </div>
              <div className="field">
                <label>Matrícula</label>
                <input value={user?.student?.sub || 'Não informada'} readOnly />
              </div>
              <div className="field">
                <label>Turma</label>
                <input value="Não informada" readOnly />
              </div>
            </div>

            <div style={{ marginTop: '20px' }}>
              <p className="muted">Solicite ajustes cadastrais à equipe da instituição.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
