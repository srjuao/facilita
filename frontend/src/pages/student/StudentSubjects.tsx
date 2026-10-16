import React from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useCourse } from '../../context/CourseContext';
import { TopBar } from '../../components/TopBar';
export const StudentSubjects: React.FC<{ onOpenLesson?: (lessonId: string) => void }> = ({ onOpenLesson }) => {
 const { user } = useAuth(); const { modules, loading, error } = useCourse();
 return <div><TopBar currentPage="Matérias" /><section className="unit-setup"><h1>Matérias e aulas</h1>{loading ? <p role="status">Carregando matérias…</p> : error ? <p role="alert">{error}</p> : !modules.length ? <section className="card"><h2>{user?.courseId ? 'Nenhuma matéria publicada' : 'Nenhum curso associado'}</h2><p>A instituição disponibilizará os conteúdos nesta área.</p></section> : modules.map(module => <section className="card" key={module.id} style={{ marginBottom: 16 }}><h2>{module.nome}</h2>{module.desc && <p>{module.desc}</p>}{module.lessons.length ? module.lessons.map(lesson => <article key={lesson.id} style={{ padding: '12px 0' }}><h3>{lesson.titulo}</h3>{lesson.prof && <p>{lesson.prof}</p>}{lesson.duracao && <p>{lesson.duracao}</p>}{onOpenLesson && <button className="btn primary" onClick={() => onOpenLesson(lesson.id)}>Abrir aula</button>}</article>) : <p>Nenhuma aula publicada nesta matéria.</p>}</section>)}</section></div>;
};
