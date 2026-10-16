import React from 'react';
import { useAuth } from '../../auth/AuthContext';
import { TopBar } from '../../components/TopBar';
export const StudentProfile: React.FC = () => {
 const { user } = useAuth();
 return <div><TopBar currentPage="Meu perfil" /><section className="unit-setup"><h1>Meu perfil</h1>{user ? <section className="card"><dl><dt>Nome</dt><dd>{user.nome}</dd><dt>E-mail</dt><dd>{user.email}</dd>{user.tenant?.nome && <><dt>Instituição</dt><dd>{user.tenant.nome}</dd></>}{user.course?.nome && <><dt>Curso</dt><dd>{user.course.nome}</dd></>}</dl><p className="muted">Para atualizar seus dados cadastrais, entre em contato com a instituição.</p></section> : <p>Entre na sua conta para consultar o perfil.</p>}</section></div>;
};
