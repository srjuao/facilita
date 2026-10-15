import React, { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { TopBar } from '../../components/TopBar';
import api from '../../api/client';
import { Student } from '../../types';

export const CoordStudents: React.FC = () => {
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [filterRisco, setFilterRisco] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newStudent, setNewStudent] = useState({ nome: '', matricula: '', email: '', password: '' });
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (user?.courseId) {
      api.get(`/students?courseId=${user.courseId}${filterRisco ? `&risco=${filterRisco}` : ''}`)
        .then(res => setStudents(res.data))
        .catch(err => console.error(err));
    }
  }, [user, filterRisco]);

  const createStudent = async (event: React.FormEvent) => {
    event.preventDefault(); setNotice('');
    try {
      const student = (await api.post('/students', newStudent)).data as Student;
      setStudents(current => [...current, student]); setNewStudent({ nome: '', matricula: '', email: '', password: '' }); setShowCreate(false);
      setNotice('Aluno cadastrado. A conta de acesso já está pronta.');
    } catch (error: any) { setNotice(error.response?.data?.error || 'Não foi possível cadastrar o aluno.'); }
  };

  return (
    <div>
      <TopBar currentPage="Alunos" />
      <div style={{ padding: '0 28px 40px' }}>
        <div className="page-head" style={{ marginBottom: '20px' }}>
          <div>
            <h1>Alunos de {user?.course?.nome || 'Medicina'}</h1>
            <p>Acompanhamento de progresso, engajamento e alertas acadêmicos em tempo real.</p>
          </div>
          <div className="filters" style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button className={`chip ${filterRisco === '' ? 'on' : ''}`} onClick={() => setFilterRisco('')}>Todos</button>
            <button className={`chip ${filterRisco === 'alto' ? 'on' : ''}`} onClick={() => setFilterRisco('alto')}>Alto risco</button>
            <button className={`chip ${filterRisco === 'medio' ? 'on' : ''}`} onClick={() => setFilterRisco('medio')}>Atenção</button>
            <button className={`chip ${filterRisco === 'baixo' ? 'on' : ''}`} onClick={() => setFilterRisco('baixo')}>Em dia</button>
            <button className="primary" onClick={() => setShowCreate(true)}>Cadastrar aluno</button>
          </div>
        </div>

        {notice && <div className="notice ok" role="status">{notice}</div>}

        <div className="card">
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line)' }}>
                <th style={{ padding: '10px' }}>Aluno</th>
                <th style={{ padding: '10px' }}>Turma</th>
                <th style={{ padding: '10px' }}>Progresso</th>
                <th style={{ padding: '10px' }}>Nota média</th>
                <th style={{ padding: '10px' }}>Tempo total</th>
                <th style={{ padding: '10px' }}>Risco</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} style={{ borderBottom: '1px solid var(--line-2)' }}>
                  <td style={{ padding: '12px 10px' }}>
                    <b>{s.nome}</b>
                    {s.online && <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--good)' }}>● online agora</span>}
                  </td>
                  <td style={{ padding: '12px 10px' }}>{s.sub}</td>
                  <td style={{ padding: '12px 10px' }}>{s.progresso}%</td>
                  <td style={{ padding: '12px 10px', fontWeight: 700 }}>{s.nota}</td>
                  <td style={{ padding: '12px 10px' }}>{Math.round(s.tempo / 60)}h</td>
                  <td style={{ padding: '12px 10px' }}>
                    <span className={`pill ${s.risco === 'alto' ? 'crit' : s.risco === 'medio' ? 'warn' : 'good'}`}>
                      {s.risco.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '12px 10px', textAlign: 'right' }}>
                    <button className="btn sm" onClick={() => setSelectedStudent(s)}>Ver ficha</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Modal Ficha do Aluno */}
        {selectedStudent && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'grid', placeItems: 'center', zIndex: 100 }}>
            <div className="card" style={{ width: '500px', maxWidth: '90vw' }}>
              <h3>Ficha do Aluno: {selectedStudent.nome}</h3>
              <p className="muted" style={{ fontSize: '13px' }}>Turma {selectedStudent.sub} · Risco: <b>{selectedStudent.risco.toUpperCase()}</b></p>

              <div style={{ margin: '16px 0', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div><b>Progresso do Curso:</b> {selectedStudent.progresso}%</div>
                <div><b>Média das Provas:</b> {selectedStudent.nota}</div>
                <div><b>Tempo de Estudo:</b> {Math.round(selectedStudent.tempo / 60)} horas</div>
                <div><b>Flash Cards Revisados:</b> {selectedStudent.flash}</div>
              </div>

              <div style={{ textAlign: 'right', marginTop: '20px' }}>
                <button className="btn primary" onClick={() => setSelectedStudent(null)}>Fechar</button>
              </div>
            </div>
          </div>
        )}
        {showCreate && <div className="modal-backdrop"><form className="card college-form" onSubmit={createStudent}><button type="button" className="close" onClick={() => setShowCreate(false)}>×</button><p className="eyebrow">NOVO ALUNO</p><h2>Criar acesso acadêmico</h2><p className="muted">A matrícula identifica o aluno dentro deste curso.</p><label>Nome completo<input required value={newStudent.nome} onChange={event => setNewStudent({ ...newStudent, nome: event.target.value })} /></label><label>Matrícula<input required value={newStudent.matricula} onChange={event => setNewStudent({ ...newStudent, matricula: event.target.value })} /></label><label>E-mail<input required type="email" value={newStudent.email} onChange={event => setNewStudent({ ...newStudent, email: event.target.value })} /></label><label>Senha<input required type="password" minLength={8} value={newStudent.password} onChange={event => setNewStudent({ ...newStudent, password: event.target.value })} /><small>8+ caracteres, letra, número e caractere especial.</small></label><button className="primary">Cadastrar aluno</button></form></div>}
      </div>
    </div>
  );
};
