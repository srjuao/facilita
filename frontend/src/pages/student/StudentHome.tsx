import React from 'react';
import { useAuth } from '../../auth/AuthContext';
import { TopBar } from '../../components/TopBar';
export const StudentHome: React.FC<{ onNavigate: (view: string) => void }> = ({ onNavigate }) => {
 const { user } = useAuth();
 return <div><TopBar currentPage="Início" /><section className="unit-setup"><h1>Olá{user?.nome ? ', ' + user.nome : ''}</h1><section className="card"><h2>{user?.course?.nome || 'Seu curso'}</h2><p>{user?.courseId ? 'Acesse as matérias e aulas publicadas pela instituição.' : 'Sua conta ainda não está associada a um curso. Entre em contato com a instituição.'}</p>{user?.courseId && <button className="btn primary" onClick={() => onNavigate('al-materias')}>Ver matérias</button>}</section></section></div>;
};
