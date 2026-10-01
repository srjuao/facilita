import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

interface SeedCourse {
  id: string;
  nome: string;
  status: string;
  alunos: number;
  previstos?: number;
  periodos: number;
  ucs: number;
  aulas: number;
  preco: number;
  piloto?: boolean;
  adesao: number;
}

interface SeedTenant {
  id: string;
  nome: string;
  full: string;
  cidade: string;
  color: string;
  cover: string;
  dominio: string;
  admin: string;
  since: string;
  courses: SeedCourse[];
}

const TENANTS: SeedTenant[] = [
  {
    id: 'unifan',
    nome: 'UNIFAN',
    full: 'Centro Universitário Nobre',
    cidade: 'Feira de Santana, BA',
    color: '#2A78D6',
    cover: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=900&h=600&fit=crop&q=70',
    dominio: 'unifan.facilita.app',
    admin: 'Coordenação de Medicina',
    since: 'ago/2026',
    courses: [
      { id: 'med', nome: 'Medicina', status: 'Ativo', alunos: 150, periodos: 1, ucs: 3, aulas: 51, preco: 170, piloto: true, adesao: 92 },
      { id: 'odonto', nome: 'Odontologia', status: 'Em implantação', alunos: 0, previstos: 80, periodos: 0, ucs: 0, aulas: 12, preco: 150, adesao: 0 },
      { id: 'enf', nome: 'Enfermagem', status: 'Proposta', alunos: 0, previstos: 60, periodos: 0, ucs: 0, aulas: 0, preco: 120, adesao: 0 },
    ]
  },
  {
    id: 'horizonte',
    nome: 'Horizonte',
    full: 'Faculdade Horizonte',
    cidade: 'Goiânia, GO',
    color: '#3B8BE0',
    cover: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=900&h=600&fit=crop&q=70',
    dominio: 'horizonte.facilita.app',
    admin: 'Pró-reitoria acadêmica',
    since: 'mar/2026',
    courses: [
      { id: 'med', nome: 'Medicina', status: 'Ativo', alunos: 210, periodos: 2, ucs: 6, aulas: 104, preco: 170, adesao: 88 },
      { id: 'dir', nome: 'Direito', status: 'Ativo', alunos: 320, periodos: 2, ucs: 5, aulas: 88, preco: 110, adesao: 71 },
      { id: 'psico', nome: 'Psicologia', status: 'Ativo', alunos: 140, periodos: 1, ucs: 3, aulas: 40, preco: 110, adesao: 79 },
    ]
  },
  {
    id: 'serra',
    nome: 'UniSerra',
    full: 'Centro Universitário da Serra',
    cidade: 'Petrópolis, RJ',
    color: '#5FA3EE',
    cover: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?w=900&h=600&fit=crop&q=70',
    dominio: 'uniserra.facilita.app',
    admin: 'Coordenação de Saúde',
    since: 'mai/2026',
    courses: [
      { id: 'odonto', nome: 'Odontologia', status: 'Ativo', alunos: 96, periodos: 1, ucs: 3, aulas: 44, preco: 150, adesao: 84 },
      { id: 'fisio', nome: 'Fisioterapia', status: 'Ativo', alunos: 110, periodos: 1, ucs: 3, aulas: 38, preco: 120, adesao: 76 },
    ]
  }
];

const COURSE_DATA: Record<string, any> = {
  'Medicina': {
    ucs: [['UC1 · Anamnese e Exame Físico', 'Semiologia e comunicação clínica'], ['UC2 · Fundamentos Biológicos', 'Bioquímica, fisiologia e histologia'], ['UC3 · Saúde Coletiva I', 'SUS, epidemiologia e atenção primária']],
    modules: [
      ['Semiologia Geral', 'Anamnese, sinais vitais e exame físico segmentar'],
      ['Fisiologia Humana', 'Sistemas cardiovascular, respiratório e renal'],
      ['Bioquímica Médica', 'Metabolismo, enzimas e correlações clínicas'],
      ['Atenção Primária', 'Estratégia Saúde da Família e prevenção'],
    ],
    topics: ['Sinais vitais', 'Fisiologia renal', 'Exame físico cardiovascular', 'Fisiologia respiratória', 'Enzimas clínicas']
  },
  'Odontologia': {
    ucs: [['UC1 · Anatomia Cabeça e Pescoço', 'Osteologia, miologia e inervação'], ['UC2 · Cariologia e Dentística', 'Etiologia da cárie e restaurações'], ['UC3 · Histologia Oral', 'Embriologia e tecidos bucais']],
    modules: [
      ['Anatomia Cabeça e Pescoço', 'Músculos da mastigação, trigêmeo e facial'],
      ['Cariologia', 'Diagnóstico, risco e prevenção da cárie'],
      ['Dentística Restauradora', 'Preparos cavitários e adesão'],
      ['Biossegurança', 'Esterilização e controle de infecção cruzada'],
    ],
    topics: ['Nervo trigêmeo', 'Diagnóstico de cárie', 'Adesivos dentinários', 'Anestésicos locais', 'Preparo cavitário']
  }
};

const USERS_SEED = [
  { key: 'superadmin', photo: 33, email: 'admin@facilita.app', nome: 'Rafael Nogueira', papel: 'Superadmin · Facilita', role: 'superadmin', tenantId: 'unifan', courseId: 'med' },
  { key: 'coord', photo: 47, email: 'coordenacao@unifan.edu.br', nome: 'Profa. Marina Duarte', papel: 'Coordenação · Medicina UNIFAN', role: 'coord', tenantId: 'unifan', courseId: 'med' },
  { key: 'aluno', photo: 12, email: 'joao.silva@aluno.unifan.edu.br', nome: 'João Silva', papel: 'Estudante · 1º período', role: 'aluno', tenantId: 'unifan', courseId: 'med' },
  { key: 'coordOdonto', photo: 56, email: 'coordenacao@uniserra.edu.br', nome: 'Prof. Henrique Sales', papel: 'Coordenação · Odontologia UniSerra', role: 'coord', tenantId: 'serra', courseId: 'odonto' },
  { key: 'alunoOdonto', photo: 25, email: 'ana.ribeiro@aluno.uniserra.edu.br', nome: 'Ana Paula Ribeiro', papel: 'Estudante · 1º período', role: 'aluno', tenantId: 'serra', courseId: 'odonto' },
];

const FIRST = ['Ana', 'Beatriz', 'Bruno', 'Camila', 'Carlos', 'Clara', 'Daniel', 'Débora', 'Eduardo', 'Fernanda', 'Gabriel', 'Giovanna', 'Gustavo', 'Helena', 'Igor', 'Isabela', 'João', 'Júlia', 'Larissa', 'Leonardo', 'Letícia', 'Lucas', 'Luiza', 'Marcos', 'Mariana', 'Mateus', 'Nathália', 'Pedro', 'Rafael', 'Rafaela', 'Renan', 'Sofia', 'Thiago', 'Vitória', 'Yasmin'];
const LAST = ['Almeida', 'Araújo', 'Barbosa', 'Cardoso', 'Carvalho', 'Costa', 'Dias', 'Ferreira', 'Gomes', 'Lima', 'Martins', 'Melo', 'Monteiro', 'Moura', 'Nascimento', 'Oliveira', 'Pereira', 'Ribeiro', 'Rocha', 'Santos', 'Silva', 'Souza', 'Teixeira', 'Vieira'];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function rnd(a: number, b: number): number { return a + Math.random() * (b - a); }
function ri(a: number, b: number): number { return Math.floor(rnd(a, b + 1)); }

async function main() {
  console.log('Limpando banco de dados...');
  await prisma.chatMessage.deleteMany();
  await prisma.question.deleteMany();
  await prisma.exam.deleteMany();
  await prisma.module.deleteMany();
  await prisma.user.deleteMany();
  await prisma.student.deleteMany();
  await prisma.course.deleteMany();
  await prisma.tenant.deleteMany();

  console.log('Semeando Tenants e Courses...');
  for (const t of TENANTS) {
    await prisma.tenant.create({
      data: {
        id: t.id,
        nome: t.nome,
        full: t.full,
        cidade: t.cidade,
        color: t.color,
        cover: t.cover,
        dominio: t.dominio,
        admin: t.admin,
        since: t.since,
        courses: {
          create: t.courses.map(c => ({
            id: `${t.id}_${c.id}`,
            nome: c.nome,
            status: c.status,
            alunos: c.alunos,
            previstos: c.previstos || 0,
            periodos: c.periodos,
            ucs: c.ucs,
            aulas: c.aulas,
            preco: c.preco,
            adesao: c.adesao,
            piloto: c.piloto || false,
          }))
        }
      }
    });
  }

  // Criar Módulos e Alunos para cada Curso
  const defaultPasswordHash = await bcrypt.hash('facilita2026', 10);

  const allCourses = await prisma.course.findMany({ include: { tenant: true } });
  for (const course of allCourses) {
    const data = COURSE_DATA[course.nome] || COURSE_DATA['Medicina'];

    // Módulos
    const modules = [];
    for (let i = 0; i < data.modules.length; i++) {
      const m = data.modules[i];
      const modId = `m_${course.id}_${i}`;
      const aulasList = Array.from({ length: i === 3 ? 5 : 4 }, (_, k) =>
        i === 3 ? `Caso ${k + 1} — ${data.topics[k % data.topics.length]}` : `${m[0]} — aula ${k + 1}: ${data.topics[k % data.topics.length]}`
      );
      const mod = await prisma.module.create({
        data: {
          id: modId,
          nome: m[0],
          desc: m[1],
          img: 'https://images.unsplash.com/photo-1571260899304-425eee4c7efc?w=900&h=600&fit=crop&q=70',
          color: ['#2A78D6', '#eb6834', '#1baf7a', '#eda100'][i % 4],
          aulas: aulasList.length,
          lista: JSON.stringify(aulasList),
          courseId: course.id,
        }
      });

      // Semeando Aulas dentro do Módulo
      const sampleVideos = [
        'https://www.youtube.com/embed/dQw4w9WgXcQ',
        'https://www.youtube.com/embed/9bZkp7q19f0',
        'https://www.youtube.com/embed/L_LUpnjgPso',
        'https://www.youtube.com/embed/fJ9rUzIMcZQ'
      ];

      for (let k = 0; k < aulasList.length; k++) {
        await prisma.lesson.create({
          data: {
            id: `les_${mod.id}_${k}`,
            titulo: aulasList[k],
            desc: `Nesta aula abordaremos os conceitos fundamentais de ${aulasList[k]}, com discussão de casos clínicos e aplicação prática em exames de prova.`,
            videoUrl: sampleVideos[k % sampleVideos.length],
            duracao: `${45 + k * 10} min`,
            prof: ['Prof. Dr. Sérgio Amaral', 'Profa. Dra. Helena Castro', 'Prof. Dr. Luís Prado', 'Profa. Dra. Paula Reis'][k % 4],
            pdfUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
            moduleId: mod.id
          }
        });
      }

      modules.push(mod);
    }

    // Provas
    const ucsList = data.ucs;
    const exam1 = await prisma.exam.create({
      data: {
        nome: `Simulado ${ucsList[0][0].split(' · ')[0]} · ${data.modules[0][0]} e ${data.modules[1][0]}`,
        data: '12/09/2026',
        q: 30,
        feitos: Math.round((course.alunos || 40) * 0.94),
        media: 7.1,
        tempo: 38,
        dificil: `${data.topics[2]} (54% erro)`,
        courseId: course.id,
        questions: {
          create: data.topics.map((t: string, idx: number) => ({
            topic: t,
            enunciado: `Sobre ${t.toLowerCase()}, assinale a alternativa correta:`,
            alts: JSON.stringify([
              `É um conceito central de ${data.modules[idx % 4][0]} e aparece na aula ${idx % 4 + 1}`,
              `Não tem relação com ${data.modules[idx % 4][0]}`,
              `Só é abordado em ${data.modules[(idx + 1) % 4][0]}`,
              'Nenhuma das anteriores'
            ]),
            correta: 0,
            comentario: `${t} é trabalhado em ${data.modules[idx % 4][0]}; a pegadinha é confundir com o conteúdo de ${data.modules[(idx + 1) % 4][0]}.`,
            erro: [61, 54, 47, 44, 39][idx] || 30,
            dist: JSON.stringify([55, 20, 15, 10]),
            courseId: course.id
          }))
        }
      }
    });

    // Criar Estudantes se o curso tiver alunos
    const nAlunos = course.alunos > 0 ? course.alunos : 15;
    for (let i = 0; i < Math.min(nAlunos, 30); i++) {
      const nome = `${pick(FIRST)} ${pick(LAST)} ${pick(LAST)}`;
      const sub = `SUB ${String(1 + (i % 2)).padStart(2, '0')}`;
      const progresso = Math.round(rnd(30, 95));
      const nota = +Math.min(9.8, Math.max(3.5, 3.6 + progresso / 15 + rnd(-0.7, 0.9))).toFixed(1);
      const tempo = Math.round(progresso * rnd(0.55, 1.1) * 60);
      const ultimo = ri(0, 7);
      const risco = progresso < 35 || nota < 5.5 || ultimo > 7 ? 'alto' : progresso < 55 || nota < 6.5 || ultimo > 4 ? 'medio' : 'baixo';
      const online = ultimo === 0 && Math.random() < 0.4;
      const ativ = ['Assistindo aula', `${data.modules[0][0]} · Aula 3`, modules[0].id];

      const student = await prisma.student.create({
        data: {
          nome,
          sub,
          progresso,
          nota,
          tempo,
          ultimo,
          risco,
          online,
          atividade: JSON.stringify(ativ),
          desde: ri(3, 48),
          usoProva: +rnd(1.4, 3.2).toFixed(1),
          flash: ri(120, 980),
          acerto: Math.round(Math.min(96, Math.max(38, nota * 9 + rnd(-6, 6)))),
          weeks: JSON.stringify(Array.from({ length: 8 }, () => ri(0, 8))),
          notas: JSON.stringify({ [modules[0].id]: nota }),
          tempos: JSON.stringify({ [modules[0].id]: Math.round(tempo * 0.3) }),
          courseId: course.id
        }
      });

      // Se for o primeiro estudante do unifan_med, associar ao User João Silva
      if (course.id === 'unifan_med' && i === 0) {
        await prisma.chatMessage.createMany({
          data: [
            { role: 'me', content: `Me explica ${data.topics[0].toLowerCase()} de forma simples`, studentId: student.id },
            { role: 'ai', content: `<b>${data.topics[0]}</b> é um dos pontos centrais de ${data.modules[0][0]}. Em resumo: comece pelo conceito, depois veja como aparece na prática.`, studentId: student.id }
          ]
        });
      }
    }
  }

  console.log('Criando Usuários de demonstração...');
  for (const u of USERS_SEED) {
    const courseId = `${u.tenantId}_${u.courseId}`;
    const student = u.role === 'aluno' ? await prisma.student.findFirst({ where: { courseId } }) : null;

    await prisma.user.create({
      data: {
        email: u.email,
        password: defaultPasswordHash,
        nome: u.nome,
        papel: u.papel,
        role: u.role,
        photo: u.photo,
        tenantId: u.tenantId,
        courseId: courseId,
        studentId: student ? student.id : undefined,
      }
    });
  }

  console.log('Seed concluído com sucesso!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
