import React from 'react';
import { BookOpen, Building2, Mail, UserRound } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { TopBar } from '../../components/TopBar';
import './StudentProfile.css';

export const StudentProfile: React.FC = () => {
  const { user } = useAuth();
  return <div><TopBar currentPage="Meu perfil" /><main className="unit-setup student-profile">
    <header className="student-profile-heading"><p className="eyebrow">MINHA CONTA</p><h1>Meu perfil</h1><p>Seus dados de acesso e o vínculo com a instituição.</p></header>
    {user ? <section className="card student-profile-card" aria-label="Dados da conta">
      <div className="student-profile-identity"><span className="student-profile-avatar" aria-hidden="true">{user.nome?.trim().charAt(0).toLocaleUpperCase('pt-BR') || <UserRound size={25} />}</span><div><h2>{user.nome}</h2><p>{user.tenant?.nome || 'Conta acadêmica'}</p></div></div>
      <dl className="student-profile-fields">
        <div><dt><UserRound size={17} /> Nome</dt><dd>{user.nome}</dd></div>
        <div><dt><Mail size={17} /> E-mail</dt><dd>{user.email}</dd></div>
        {user.tenant?.nome && <div><dt><Building2 size={17} /> Instituição</dt><dd>{user.tenant.nome}</dd></div>}
        {user.course?.nome && <div><dt><BookOpen size={17} /> Curso</dt><dd>{user.course.nome}</dd></div>}
      </dl>
      <p className="student-profile-note">Precisa corrigir alguma informação? Solicite a atualização à sua instituição.</p>
    </section> : <section className="card student-profile-empty"><UserRound size={28} /><h2>Você não está conectado</h2><p>Entre na sua conta para consultar o perfil.</p></section>}
  </main></div>;
};
