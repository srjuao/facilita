export interface User {
  id: string;
  email: string;
  nome: string;
  papel: string;
  role: 'superadmin' | 'coord' | 'aluno';
  photo: number;
  tenantId?: string;
  courseId?: string;
  studentId?: number;
  tenant?: Tenant;
  course?: Course;
  student?: Student;
}

export interface Course {
  id: string;
  nome: string;
  status: string;
  alunos: number;
  previstos: number;
  periodos: number;
  ucs: number;
  aulas: number;
  preco: number;
  adesao: number;
  piloto?: boolean;
}

export interface Tenant {
  id: string;
  nome: string;
  full: string;
  cidade: string;
  color: string;
  cover: string;
  dominio: string;
  admin: string;
  since: string;
  courses: Course[];
}

export interface Student {
  id: number;
  nome: string;
  sub: string;
  progresso: number;
  nota: number;
  tempo: number;
  ultimo: number;
  risco: 'alto' | 'medio' | 'baixo';
  online: boolean;
  atividade: [string, string, string];
  desde: number;
  usoProva: number;
  flash: number;
  acerto: number;
  weeks: number[];
  notas: Record<string, number>;
  tempos: Record<string, number>;
}

export interface Module {
  id: string;
  nome: string;
  desc: string;
  img: string;
  color: string;
  aulas: number;
  lista: string[];
}

export interface ChatMessage {
  id: string;
  role: 'me' | 'ai';
  content: string;
  createdAt?: string;
}

export interface Exam {
  id: string;
  nome: string;
  data: string;
  q: number;
  feitos: number;
  media: number | null;
  tempo: number | null;
  dificil: string;
  futura?: boolean;
  questions?: Question[];
}

export interface Question {
  id: number;
  topic: string;
  enunciado: string;
  alts: string[];
  correta: number;
  comentario: string;
  erro: number;
  dist: number[];
}
